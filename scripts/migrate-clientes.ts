/**
 * One-shot migration: Cliente schema for Section 10 (engagement-based Tablero)
 *
 * Migrates every doc in the `clientes` collection from the old schema
 * (estado: Contacto Inicial / Propuesta Enviada / Presupuesto Aprobado / En Ejecución / Finalizado / Archivado;
 *  tipoProyecto: Paisajismo Regenerativo / Diseño y Manejo del Agua / Bosque Comestible / Taller Presencial / Consultoría / Otro)
 * to the new schema
 * (estado: Antes / Durante / Después / Completo / Archivado;
 *  categoria: Visita Técnica / Diseño Conceptual / Diseño Técnico / Implementación / Indefinido / Otro;
 *  checklist: ChecklistItem[]).
 *
 * Mapping (locked with user 2026-04-27):
 *   estado:
 *     Contacto Inicial      → Antes
 *     Propuesta Enviada     → Antes
 *     Presupuesto Aprobado  → Durante
 *     En Ejecución          → Durante
 *     Finalizado            → Completo
 *     Archivado             → Archivado
 *
 *   tipoProyecto → categoria:
 *     Consultoría               → Visita Técnica
 *     Paisajismo Regenerativo   → Indefinido
 *     Diseño y Manejo del Agua  → Indefinido
 *     Bosque Comestible         → Indefinido
 *     Taller Presencial         → Otro
 *     Otro                      → Otro
 *     '' (empty)                → Indefinido
 *
 * Checklist seeding: copied from CHECKLIST_TEMPLATES for the resolved categoría
 * (empty for Indefinido / Otro).
 *
 * Usage:
 *   1. Generate a service account key in Firebase Console
 *      → Project Settings → Service Accounts → Generate new private key
 *   2. Save the JSON as `serviceAccountKey.json` in the repo root (gitignored)
 *   3. Dry-run (default — prints what would change, writes nothing):
 *        npx tsx scripts/migrate-clientes.ts
 *   4. Inspect the output. If it looks right:
 *        npx tsx scripts/migrate-clientes.ts --apply
 *   5. After a successful run, delete serviceAccountKey.json from disk.
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHECKLIST_TEMPLATES,
  CategoriaCliente,
  EstadoCliente,
} from '../src/app/shared/models/cliente.model';

const APPLY = process.argv.includes('--apply');
const KEY_PATH = resolve(process.cwd(), 'serviceAccountKey.json');

const ESTADO_MAP: Record<string, EstadoCliente> = {
  'Contacto Inicial':     'Antes',
  'Propuesta Enviada':    'Antes',
  'Presupuesto Aprobado': 'Durante',
  'En Ejecución':         'Durante',
  'Finalizado':           'Completo',
  'Archivado':            'Archivado',
};

const CATEGORIA_MAP: Record<string, CategoriaCliente> = {
  'Consultoría':              'Visita Técnica',
  'Paisajismo Regenerativo':  'Indefinido',
  'Diseño y Manejo del Agua': 'Indefinido',
  'Bosque Comestible':        'Indefinido',
  'Taller Presencial':        'Otro',
  'Otro':                     'Otro',
  '':                         'Indefinido',
};

function buildChecklistFromTemplate(categoria: CategoriaCliente) {
  return CHECKLIST_TEMPLATES[categoria].map(item => ({
    texto: item.texto,
    fase: item.fase,
    completado: false,
    completadoEn: null,
    completadoPor: '',
  }));
}

async function main(): Promise<void> {
  console.log(`\n=== Cliente migration ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY-RUN (no writes)'}\n`);

  // Read service account
  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  } catch (err) {
    console.error(`ERROR: could not read ${KEY_PATH}`);
    console.error(`Generate a service account key in Firebase Console and save it there.`);
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const snap = await db.collection('clientes').get();
  console.log(`Found ${snap.size} cliente docs\n`);

  const estadoCounts: Record<string, number> = {};
  const categoriaCounts: Record<string, number> = {};

  // Firestore batches max 500 ops; we only do 1 op per doc so chunk every 500 docs
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let opsInBatch = 0;
  const batches: Promise<unknown>[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const oldEstado = data.estado as string;
    const oldTipo   = (data.tipoProyecto ?? '') as string;

    const newEstado    = ESTADO_MAP[oldEstado] ?? 'Antes';
    const newCategoria = CATEGORIA_MAP[oldTipo] ?? 'Indefinido';
    const checklist    = buildChecklistFromTemplate(newCategoria);

    const transitionEstado    = `${oldEstado} → ${newEstado}`;
    const transitionCategoria = `${oldTipo || '(empty)'} → ${newCategoria}`;
    estadoCounts[transitionEstado]       = (estadoCounts[transitionEstado] ?? 0) + 1;
    categoriaCounts[transitionCategoria] = (categoriaCounts[transitionCategoria] ?? 0) + 1;

    console.log(`  ${doc.id}  "${data.nombre ?? '?'}"`);
    console.log(`    estado:    ${transitionEstado}`);
    console.log(`    categoria: ${transitionCategoria}`);
    console.log(`    checklist: ${checklist.length} items seeded`);

    if (APPLY) {
      batch.update(doc.ref, {
        estado:        newEstado,
        categoria:     newCategoria,
        checklist,
        tipoProyecto:  admin.firestore.FieldValue.delete(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
      opsInBatch++;
      if (opsInBatch >= BATCH_SIZE) {
        batches.push(batch.commit());
        batch = db.batch();
        opsInBatch = 0;
      }
    }
  }

  if (APPLY && opsInBatch > 0) {
    batches.push(batch.commit());
  }

  if (APPLY) {
    await Promise.all(batches);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Estado transitions:`);
  Object.entries(estadoCounts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nCategoría transitions:`);
  Object.entries(categoriaCounts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nTotal docs: ${snap.size}`);
  console.log(APPLY ? `✓ APPLIED to Firestore.` : `(dry-run — no writes.) Re-run with --apply when ready.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
