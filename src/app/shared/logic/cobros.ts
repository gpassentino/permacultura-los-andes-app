// Lógica pura de hitos de cobro (pagos esperados). Sin Angular ni Firebase.
//
// Criterio de totales (una sola fuente del dinero recibido):
//   contratado = suma de los hitos
//   pagado     = suma de `pagos[]` (dinero realmente recibido, con o sin hito)
//   porCobrar  = max(0, contratado − pagado)
//   vencidos   = hitos no pagados cuya fechaEsperada ya pasó
// Por carril (los pagos no llevan carril), `pagado` es la suma de los hitos
// pagados de ese carril.

import {
  CarrilCobro,
  EstadoHitoVisible,
  HitoCobro,
  Pago,
  PlantillaPlanPago,
} from '../models/proyecto.model';

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Pendiente o con cuenta de cobro enviada, y su fecha esperada ya pasó. */
export function estaVencido(h: Pick<HitoCobro, 'estado' | 'fechaEsperada'>, ahora: Date): boolean {
  if (h.estado === 'pagado' || !h.fechaEsperada) return false;
  return inicioDelDia(h.fechaEsperada).getTime() < inicioDelDia(ahora).getTime();
}

export function estadoVisible(h: Pick<HitoCobro, 'estado' | 'fechaEsperada'>, ahora: Date): EstadoHitoVisible {
  return estaVencido(h, ahora) ? 'vencido' : h.estado;
}

export interface ResumenCobro {
  contratado: number;
  pagado: number;
  porCobrar: number;
  vencidos: number;
  montoVencido: number;
}

export function resumenCobro(
  hitos: readonly HitoCobro[] | undefined,
  pagos: readonly Pick<Pago, 'monto'>[] | undefined,
  ahora: Date,
  carril?: CarrilCobro,
): ResumenCobro {
  const hs = (hitos ?? []).filter(h => !carril || h.carril === carril);
  const contratado = hs.reduce((s, h) => s + (h.monto || 0), 0);
  const pagado = carril
    ? hs.filter(h => h.estado === 'pagado').reduce((s, h) => s + (h.monto || 0), 0)
    : (pagos ?? []).reduce((s, p) => s + (p.monto || 0), 0);
  const vencidosList = hs.filter(h => estaVencido(h, ahora));
  return {
    contratado,
    pagado,
    porCobrar:    Math.max(0, contratado - pagado),
    vencidos:     vencidosList.length,
    montoVencido: vencidosList.reduce((s, h) => s + (h.monto || 0), 0),
  };
}

/**
 * Diferencia entre la suma de los hitos y el total facturado del presupuesto.
 * 0 si coinciden; positivo si los hitos suman más.
 */
export function desajusteConFacturado(hitos: readonly HitoCobro[] | undefined, totalFacturado: number): number {
  const suma = (hitos ?? []).reduce((s, h) => s + (h.monto || 0), 0);
  return Math.round(suma - totalFacturado);
}

/**
 * ¿Está pagado el anticipo del carril? Si hay hitos del carril, el primero
 * (por orden) debe estar pagado. Sin hitos, cuenta un pago de tipo anticipo.
 */
export function anticipoPagado(
  hitos: readonly HitoCobro[] | undefined,
  pagos: readonly Pick<Pago, 'tipo' | 'monto'>[] | undefined,
  carril: CarrilCobro = 'diseno',
): boolean {
  const delCarril = [...(hitos ?? [])].filter(h => h.carril === carril).sort((a, b) => a.orden - b.orden);
  if (delCarril.length) return delCarril[0].estado === 'pagado';
  return (pagos ?? []).some(p => p.tipo === 'anticipo' && p.monto > 0);
}

// ── Plantillas ───────────────────────────────────────────────────────────────

const PORCENTAJES: Record<Exclude<PlantillaPlanPago, 'por_visita'>, { concepto: string; pct: number }[]> = {
  '50_50': [
    { concepto: 'Firma',   pct: 50 },
    { concepto: 'Entrega', pct: 50 },
  ],
  '40_40_20': [
    { concepto: 'Firma',              pct: 40 },
    { concepto: 'Entrega preliminar', pct: 40 },
    { concepto: 'Entrega final',      pct: 20 },
  ],
};

/** Reparte `total` en partes enteras; la última absorbe el redondeo. */
function repartir(total: number, pcts: number[]): number[] {
  const montos = pcts.map(p => Math.round(total * p / 100));
  const suma = montos.slice(0, -1).reduce((s, m) => s + m, 0);
  montos[montos.length - 1] = Math.round(total) - suma;
  return montos;
}

/**
 * Genera hitos editables a partir del valor total.
 * `ordenInicial` permite agregar hitos de una nueva fase después de los existentes.
 */
export function generarHitos(
  plantilla: PlantillaPlanPago,
  total: number,
  carril: CarrilCobro,
  nuevoId: () => string,
  opciones: { numVisitas?: number; ordenInicial?: number } = {},
): HitoCobro[] {
  const orden0 = opciones.ordenInicial ?? 0;
  let partes: { concepto: string; monto: number }[];

  if (plantilla === 'por_visita') {
    const n = Math.max(1, Math.floor(opciones.numVisitas ?? 1));
    const montos = repartir(total, Array.from({ length: n }, () => 100 / n));
    partes = montos.map((monto, i) => ({ concepto: `Visita ${i + 1}`, monto }));
  } else {
    const def = PORCENTAJES[plantilla];
    const montos = repartir(total, def.map(d => d.pct));
    partes = def.map((d, i) => ({ concepto: d.concepto, monto: montos[i] }));
  }

  return partes.map((p, i) => ({
    id:            nuevoId(),
    carril,
    concepto:      p.concepto,
    monto:         p.monto,
    fechaEsperada: null,
    estado:        'pendiente',
    orden:         orden0 + i,
  }));
}
