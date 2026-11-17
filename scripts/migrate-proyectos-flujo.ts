/**
 * Migración `clientes` → `proyectosFlujo` (1 a 1, mismo id). Idempotente.
 *
 * Qué hace:
 *   1. Catálogo `servicios`: reutiliza "Asesoría In-Situ" (Diagnóstico y visita técnica),
 *      renombra `informe_vision` a "Diseño conceptual" (mismo id) y crea solo los tipos que falten.
 *   2. Por cada registro de `clientes` sin proyecto: crea `proyectosFlujo/{mismo id}` y reserva
 *      su código en `codigosProyecto/{PLA-XXX}`. Enlaza `proyectoFinancieroId` si hay un registro
 *      en `proyectos` con ese `clienteId`. `clientes` NO se modifica.
 *   3. Verifica que cada cliente tenga su proyecto.
 *
 * Uso:
 *   Dry-run (por defecto, no escribe):
 *     npx tsx scripts/migrate-proyectos-flujo.ts [--dry-run]
 *   Aplicar en el emulador:
 *     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/migrate-proyectos-flujo.ts --apply
 *   Aplicar en producción (exige un respaldo reciente con los mismos conteos):
 *     npx tsx scripts/migrate-proyectos-flujo.ts --apply --respaldo respaldos/<fecha>
 *
 * El reporte completo se guarda también en respaldos/migracion-<fecha>.txt.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { admin, aFecha, destino, esEmulador, iniciarAdmin } from './lib/admin';
import { planServicios, ServicioExistente } from '../src/app/shared/logic/servicios-flujo';
import { ClienteLegacy, mapearCliente, ResultadoMigracion } from '../src/app/shared/logic/migracion-flujo';
import { ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS } from '../src/app/shared/models/proyecto-flujo.model';

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
if (APPLY && ARGS.includes('--dry-run')) {
  console.error('ERROR: usa --apply o --dry-run, no ambos.');
  process.exit(1);
}
const iResp = ARGS.indexOf('--respaldo');
const RESPALDO = iResp >= 0 ? ARGS[iResp + 1] : undefined;

const lineas: string[] = [];
function log(s = ''): void {
  console.log(s);
  lineas.push(s);
}

function fmtFecha(d?: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

/** Exige un respaldo de producción con los mismos conteos que hay ahora. */
async function verificarRespaldo(db: admin.firestore.Firestore): Promise<void> {
  if (!RESPALDO) {
    console.error('ERROR: en producción --apply exige --respaldo <carpeta> (ver scripts/respaldo-firestore.ts).');
    process.exit(1);
  }
  const man = resolve(process.cwd(), RESPALDO, 'manifiesto.json');
  if (!existsSync(man)) {
    console.error(`ERROR: no existe ${man}`);
    process.exit(1);
  }
  const m = JSON.parse(readFileSync(man, 'utf8')) as { origen: string; colecciones: Record<string, number> };
  if (!m.origen.startsWith('PRODUCCIÓN')) {
    console.error(`ERROR: el respaldo no es de producción (${m.origen}).`);
    process.exit(1);
  }
  for (const col of ['clientes', 'proyectos', 'contacts', 'servicios']) {
    const actual = (await db.collection(col).count().get()).data().count;
    if (m.colecciones[col] !== actual) {
      console.error(`ERROR: ${col} tiene ${actual} documentos y el respaldo ${m.colecciones[col]}. Haz un respaldo nuevo.`);
      process.exit(1);
    }
  }
  log(`Respaldo verificado: ${resolve(process.cwd(), RESPALDO)}`);
}

async function main(): Promise<void> {
  const db = iniciarAdmin();
  const ahora = new Date();

  log(`=== Migración clientes → proyectosFlujo ===`);
  log(`Destino: ${destino()}`);
  log(`Modo:    ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (no escribe nada)'}`);
  log(`Fecha:   ${ahora.toISOString()}`);
  log();

  if (APPLY && !esEmulador()) await verificarRespaldo(db);

  // ── Lecturas ──────────────────────────────────────────────────────────────
  const [serviciosSnap, clientesSnap, contactsSnap, financierosSnap, flujoSnap, codigosSnap] = await Promise.all([
    db.collection('servicios').get(),
    db.collection('clientes').get(),
    db.collection('contacts').get(),
    db.collection('proyectos').get(),
    db.collection('proyectosFlujo').get(),
    db.collection('codigosProyecto').get(),
  ]);

  // ── 1. Servicios ──────────────────────────────────────────────────────────
  const existentes: ServicioExistente[] = serviciosSnap.docs.map(d => ({
    id: d.id, tipo: d.get('tipo'), nombre: d.get('nombre'), orden: d.get('orden'), activo: d.get('activo'),
  }));
  const plan = planServicios(existentes);

  log(`── 1. Catálogo de servicios (${existentes.length} existentes) ──`);
  for (const [tipo, id] of Object.entries(plan.idPorTipo)) {
    const s = existentes.find(e => e.id === id);
    log(`  ${tipo.padEnd(17)} → ${s ? `usa "${s.nombre}" (${id})` : 'SE CREA'}`);
  }
  for (const r of plan.renombrar) log(`  RENOMBRAR ${r.id}: "${r.de}" → "${r.a}"`);
  for (const c of plan.crear) log(`  CREAR "${c.nombre}" (tipo ${c.tipo}, orden ${c.orden}, precio por cotizar)`);
  for (const a of plan.avisos) log(`  ⚠ ${a}`);
  if (!plan.renombrar.length && !plan.crear.length) log('  Sin cambios.');
  log();

  const idPorTipo = { ...plan.idPorTipo };
  if (APPLY && (plan.crear.length || plan.renombrar.length)) {
    const batch = db.batch();
    for (const r of plan.renombrar) {
      batch.update(db.collection('servicios').doc(r.id), {
        nombre: r.a, actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    for (const c of plan.crear) {
      const ref = db.collection('servicios').doc();
      idPorTipo[c.tipo] = ref.id;
      batch.set(ref, {
        ...c,
        creadoPor: 'migracion-flujo',
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    log('  ✓ Servicios actualizados.');
    log();
  }
  const nombreServicio = (id: string): string => {
    const tipo = Object.entries(idPorTipo).find(([, v]) => v === id)?.[0];
    return existentes.find(e => e.id === id)?.nombre
      ?? plan.crear.find(c => c.tipo === tipo)?.nombre
      ?? id;
  };

  // ── 2. Proyectos ──────────────────────────────────────────────────────────
  const nombreContacto = new Map(contactsSnap.docs.map(d => [d.id, (d.get('name') as string) ?? '']));
  const financieroPorCliente = new Map<string, string>();
  for (const d of financierosSnap.docs) {
    const cid = d.get('clienteId') as string | undefined;
    if (!cid) continue;
    if (financieroPorCliente.has(cid)) log(`  ⚠ Hay más de un registro financiero para el cliente ${cid}; se enlaza ${financieroPorCliente.get(cid)}.`);
    else financieroPorCliente.set(cid, d.id);
  }
  const yaMigrados = new Set(flujoSnap.docs.map(d => d.id));
  const codigosUsados = new Set<string>([
    ...codigosSnap.docs.map(d => d.id),
    ...flujoSnap.docs.map(d => d.get('codigo') as string).filter(Boolean),
  ]);

  const clientes: ClienteLegacy[] = clientesSnap.docs
    .map(d => {
      const x = d.data();
      return {
        id: d.id,
        contactoId: x['contactoId'] || undefined,
        nombre: x['nombre'],
        categoria: x['categoria'],
        estado: x['estado'],
        municipio: x['municipio'],
        notas: x['notas'],
        documentos: x['documentos'],
        checklist: x['checklist'],
        recordatorioFecha: aFecha(x['recordatorioFecha']),
        recordatorioMensaje: x['recordatorioMensaje'],
        fechaUltimoContacto: aFecha(x['fechaUltimoContacto']),
        fechaEstimadaInicio: aFecha(x['fechaEstimadaInicio']),
        creadoEn: aFecha(x['creadoEn']),
        creadoPor: x['creadoPor'],
        actualizadoEn: aFecha(x['actualizadoEn']),
      } satisfies ClienteLegacy;
    })
    .sort((a, b) => (a.creadoEn?.getTime() ?? 0) - (b.creadoEn?.getTime() ?? 0));

  const pendientes = clientes.filter(c => !yaMigrados.has(c.id));
  const resultados: ResultadoMigracion[] = pendientes.map(c =>
    mapearCliente(c, {
      servicioIdPorTipo: idPorTipo,
      codigosUsados,
      proyectoFinancieroId: financieroPorCliente.get(c.id),
      ahora,
    }),
  );

  log(`── 2. Proyectos (${clientes.length} clientes · ${clientes.length - pendientes.length} ya migrados · ${pendientes.length} por crear) ──`);

  // Agrupar por contacto para revisar personas con varios proyectos
  const porContacto = new Map<string, ResultadoMigracion[]>();
  for (const r of resultados) {
    const k = r.proyecto.contactoId || '(sin contacto)';
    porContacto.set(k, [...(porContacto.get(k) ?? []), r]);
  }
  const grupos = [...porContacto.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [contactoId, rs] of grupos) {
    const nombre = nombreContacto.get(contactoId) ?? (contactoId === '(sin contacto)' ? '' : '⚠ contacto no encontrado');
    log();
    log(`▸ ${nombre || contactoId}  [${contactoId}]${rs.length > 1 ? `  ⚠ ${rs.length} proyectos del mismo contacto` : ''}`);
    for (const r of rs) {
      const p = r.proyecto;
      const ejec = p.etapaEjecucion ? ` + ${ETAPAS_EJECUCION_LABELS[p.etapaEjecucion]}` : '';
      log(`    ${p.codigo}  "${p.nombreProyecto}"  (id ${r.id})`);
      log(`      antes:      ${r.detalle.estadoAnterior || '—'} · ${r.detalle.categoriaAnterior || '—'}`);
      log(`      etapa:      ${ETAPAS_FLUJO_LABELS[p.etapaFlujo]}${ejec}  desde ${fmtFecha(p.etapaFlujoDesde)} (${r.detalle.fuenteEtapaDesde})`);
      log(`      servicios:  ${p.servicioIds.length ? p.servicioIds.map(nombreServicio).join(', ') : '— (vacío)'}`);
      if (p.visitaTecnica !== 'no_aplica') log(`      visita:     ${p.visitaTecnica}`);
      if (p.municipio)   log(`      municipio:  ${p.municipio}`);
      if (p.proximoPaso) log(`      próx. paso: ${p.proximoPaso.texto}${p.proximoPaso.fecha ? ` (${fmtFecha(p.proximoPaso.fecha)})` : ''}`);
      if (p.documentos.length) log(`      documentos: ${p.documentos.map(d => `${d.tipo}${d.version ? ' ' + d.version : ''}`).join(', ')}`);
      if (p.notas)       log(`      notas:      ${p.notas.length > 70 ? p.notas.slice(0, 70) + '…' : p.notas}`);
      if (p.proyectoFinancieroId) log(`      financiero: ${p.proyectoFinancieroId}`);
      log(`      revisar:    ${(p.revisar ?? []).join(', ')}`);
    }
  }

  // Resumen
  const cuenta = (f: (r: ResultadoMigracion) => string) =>
    resultados.reduce<Record<string, number>>((acc, r) => { const k = f(r); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  log();
  log('── Resumen ──');
  log(`  Por etapa:     ${JSON.stringify(cuenta(r => r.proyecto.etapaFlujo))}`);
  log(`  Con ejecución: ${resultados.filter(r => r.proyecto.etapaEjecucion).length}`);
  log(`  Sin servicio:  ${resultados.filter(r => !r.proyecto.servicioIds.length).length}`);
  log(`  Sin contacto:  ${resultados.filter(r => !r.proyecto.contactoId).length}`);
  log(`  Con registro financiero: ${resultados.filter(r => r.proyecto.proyectoFinancieroId).length}`);
  log(`  Contactos con varios proyectos: ${grupos.filter(([, rs]) => rs.length > 1).length}`);

  // ── Escritura ─────────────────────────────────────────────────────────────
  if (APPLY) {
    log();
    log('── Escribiendo ──');
    let creados = 0;
    const fallidos: string[] = [];
    for (const r of resultados) {
      const batch = db.batch();
      // create() falla si ya existe: nunca sobreescribe
      batch.create(db.collection('proyectosFlujo').doc(r.id), r.proyecto);
      batch.create(db.collection('codigosProyecto').doc(r.proyecto.codigo), {
        proyectoId: r.id, creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
      try {
        await batch.commit();
        creados++;
      } catch (e) {
        fallidos.push(`${r.id} (${(e as Error).message})`);
      }
    }
    log(`  Creados: ${creados} · Fallidos: ${fallidos.length}`);
    for (const f of fallidos) log(`  ✗ ${f}`);

    // ── 3. Verificación ─────────────────────────────────────────────────────
    const despues = new Set((await db.collection('proyectosFlujo').get()).docs.map(d => d.id));
    const faltan = clientes.filter(c => !despues.has(c.id));
    log();
    log(`── 3. Verificación: ${clientes.length - faltan.length}/${clientes.length} clientes con proyecto ──`);
    for (const c of faltan) log(`  ✗ Falta ${c.id} "${c.nombre}"`);
    if (faltan.length) process.exitCode = 1;
  } else {
    log();
    log('DRY-RUN: no se escribió nada. Para aplicar usa --apply.');
  }

  const dir = resolve(process.cwd(), 'respaldos');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `migracion-${APPLY ? 'apply' : 'dryrun'}-${esEmulador() ? 'emulador' : 'produccion'}-${ahora.toISOString().replace(/[:.]/g, '-')}.txt`);
  writeFileSync(file, lineas.join('\n') + '\n');
  console.log(`\nReporte guardado en: ${file}`);
}

main().catch(err => { console.error(err); process.exit(1); });
