/**
 * Respaldo local en JSON de colecciones de Firestore, y restauración SOLO al emulador.
 *
 * Respaldar (producción, con serviceAccountKey.json):
 *   npx tsx scripts/respaldo-firestore.ts
 *   → respaldos/<fecha>/<colección>.json + manifiesto.json (conteos)
 *
 * Restaurar en el emulador (para probar la migración con una copia real):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/respaldo-firestore.ts --restaurar respaldos/<fecha>
 *
 * La restauración se niega a correr contra producción.
 * Los Timestamps se guardan como {"__ts": "<ISO>", "s": <seg>, "ns": <nanoseg>} para restaurarlos exactos.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { admin, destino, esEmulador, iniciarAdmin } from './lib/admin';

export const COLECCIONES_RESPALDO = ['clientes', 'proyectos', 'contacts', 'servicios'] as const;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function serializar(v: unknown): Json {
  if (v === null || v === undefined) return null;
  if (v instanceof admin.firestore.Timestamp) {
    return { __ts: v.toDate().toISOString(), s: v.seconds, ns: v.nanoseconds };
  }
  if (v instanceof admin.firestore.GeoPoint) return { __geo: [v.latitude, v.longitude] };
  if (v instanceof admin.firestore.DocumentReference) return { __ref: v.path };
  if (Array.isArray(v)) return v.map(serializar);
  if (typeof v === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = serializar(x);
    return out;
  }
  return v as Json;
}

function deserializar(v: Json, db: admin.firestore.Firestore): unknown {
  if (Array.isArray(v)) return v.map(x => deserializar(x, db));
  if (v && typeof v === 'object') {
    if ('__ts' in v) return new admin.firestore.Timestamp(v['s'] as number, v['ns'] as number);
    if ('__geo' in v) { const [la, lo] = v['__geo'] as number[]; return new admin.firestore.GeoPoint(la, lo); }
    if ('__ref' in v) return db.doc(v['__ref'] as string);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = deserializar(x, db);
    return out;
  }
  return v;
}

async function respaldar(db: admin.firestore.Firestore): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(process.cwd(), 'respaldos', stamp);
  mkdirSync(dir, { recursive: true });

  const manifiesto: Record<string, unknown> = { origen: destino(), fecha: new Date().toISOString(), colecciones: {} };
  for (const col of COLECCIONES_RESPALDO) {
    const snap = await db.collection(col).get();
    const docs = snap.docs.map(d => ({ id: d.id, data: serializar(d.data()) }));
    writeFileSync(join(dir, `${col}.json`), JSON.stringify(docs, null, 2));
    (manifiesto['colecciones'] as Record<string, number>)[col] = docs.length;
    console.log(`  ${col.padEnd(12)} ${docs.length} documentos`);
  }
  writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  console.log(`\nRespaldo guardado en: ${dir}`);
}

async function restaurar(db: admin.firestore.Firestore, dirArg: string): Promise<void> {
  if (!esEmulador()) {
    console.error('ERROR: --restaurar solo se permite contra el emulador (define FIRESTORE_EMULATOR_HOST).');
    process.exit(1);
  }
  const dir = resolve(process.cwd(), dirArg);
  if (!existsSync(join(dir, 'manifiesto.json'))) {
    console.error(`ERROR: ${dir} no tiene manifiesto.json`);
    process.exit(1);
  }
  for (const col of COLECCIONES_RESPALDO) {
    const file = join(dir, `${col}.json`);
    if (!existsSync(file)) continue;
    const docs = JSON.parse(readFileSync(file, 'utf8')) as { id: string; data: Json }[];
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + 400)) {
        batch.set(db.collection(col).doc(d.id), deserializar(d.data, db) as admin.firestore.DocumentData);
      }
      await batch.commit();
    }
    console.log(`  ${col.padEnd(12)} ${docs.length} documentos restaurados`);
  }
}

async function main(): Promise<void> {
  const db = iniciarAdmin();
  const i = process.argv.indexOf('--restaurar');
  if (i >= 0) {
    console.log(`\n=== Restaurar respaldo → ${destino()} ===\n`);
    await restaurar(db, process.argv[i + 1] ?? '');
  } else {
    console.log(`\n=== Respaldo de ${destino()} ===\n`);
    await respaldar(db);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
