// Inicialización compartida de firebase-admin para los scripts.
//   - Con FIRESTORE_EMULATOR_HOST definido → emulador (sin credenciales).
//   - Sin él → producción, con serviceAccountKey.json en la raíz del repo.

import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROJECT_ID = 'permacultura-los-andes';

export function esEmulador(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST'];
}

export function iniciarAdmin(): admin.firestore.Firestore {
  if (esEmulador()) {
    admin.initializeApp({ projectId: PROJECT_ID });
  } else {
    const keyPath = resolve(process.cwd(), 'serviceAccountKey.json');
    let cred: admin.ServiceAccount;
    try {
      cred = JSON.parse(readFileSync(keyPath, 'utf8'));
    } catch {
      console.error(`ERROR: no se pudo leer ${keyPath}`);
      console.error('Genera una clave en Firebase Console → Configuración → Cuentas de servicio,');
      console.error('o define FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 para usar el emulador.');
      process.exit(1);
    }
    admin.initializeApp({ credential: admin.credential.cert(cred), projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function destino(): string {
  return esEmulador()
    ? `EMULADOR (${process.env['FIRESTORE_EMULATOR_HOST']})`
    : `PRODUCCIÓN (${PROJECT_ID})`;
}

/** Timestamp de Firestore → Date (o null). */
export function aFecha(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof admin.firestore.Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate(): Date }).toDate();
  }
  return null;
}

export { admin };
