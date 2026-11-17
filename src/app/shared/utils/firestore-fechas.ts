// Conversión recursiva de fechas entre la app (Date) y Firestore (Timestamp),
// para documentos con fechas anidadas (historial, documentos, próximo paso).

type ConToDate = { toDate(): Date };

function esTimestamp(v: unknown): v is ConToDate {
  return !!v && typeof v === 'object' && typeof (v as ConToDate).toDate === 'function';
}

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}

/** Timestamp → Date en todo el árbol. */
export function deFirestore<T>(valor: unknown): T {
  if (esTimestamp(valor)) return valor.toDate() as T;
  if (Array.isArray(valor)) return valor.map(v => deFirestore(v)) as T;
  if (esObjetoPlano(valor)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) out[k] = deFirestore(v);
    return out as T;
  }
  return valor as T;
}

/**
 * Date → Timestamp en todo el árbol y quita `undefined` (Firestore lo rechaza).
 * Objetos que no son planos (FieldValue, Timestamp…) pasan tal cual.
 */
export function aFirestore(valor: unknown, deFecha: (d: Date) => unknown): unknown {
  if (valor instanceof Date) return deFecha(valor);
  if (Array.isArray(valor)) return valor.map(v => aFirestore(v, deFecha));
  if (esObjetoPlano(valor)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (v === undefined) continue;
      out[k] = aFirestore(v, deFecha);
    }
    return out;
  }
  return valor;
}
