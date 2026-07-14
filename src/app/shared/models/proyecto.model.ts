import { CategoriaCliente } from './cliente.model';

// ── Payment (Pago) ──────────────────────────────────────────────
export const TIPOS_PAGO = ['anticipo', 'pago_final', 'otro'] as const;
export type TipoPago = typeof TIPOS_PAGO[number];

export const METODOS_PAGO = ['Transferencia', 'Nequi', 'Efectivo', 'Otro'] as const;
export type MetodoPago = typeof METODOS_PAGO[number];

export interface Pago {
  id: string;
  tipo: TipoPago;
  monto: number;
  fecha: Date | null;
  metodo: MetodoPago;
  notas: string;
}

// ── Expenses (Gasto) ────────────────────────────────────────────
export const TIPOS_GASTO = [
  'sofia',
  'carlos',
  'ayudante',
  'pastrana',
  'trabajador_otro',
  'planta',
  'insumo',
  'logistica',
  'viatico',
  'otro'
] as const;
export type TipoGasto = typeof TIPOS_GASTO[number];

export interface Gasto {
  id: string;
  tipo: TipoGasto;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
  notas: string;
}

// ── Plant line item (used in internal presupuesto) ─────────────
export const TAMANIOS_BOLSA = ['P', 'M', 'G', 'Estaca'] as const;
export type TamanioBolsa = typeof TAMANIOS_BOLSA[number];

export interface LineaPlanta {
  id: string;
  nombreArbol: string;
  nombrePlanta: string;
  cantidad: number;
  tamanioBolsa: TamanioBolsa;
  precioUnitario: number;
  subtotal: number;
}

// ── Budget line items ────────────────────────────────────────────
export interface LineaPresupuesto {
  id: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
}

// ── Viáticos ────────────────────────────────────────────────────
export interface ViaticosData {
  municipio: string;
  kmIdaVuelta: number;
  numPeajes: number;
  costoPeajeTotal: number; // total for all peajes round trip
  gastoGasolina: number;
  total: number;
  editadoManualmente: boolean;
}

// ── Internal presupuesto (full detail, Andrés only) ─────────────
export interface PresupuestoInterno {
  // For design cards (Visita Técnica, Diseño Conceptual, Diseño Técnico)
  tarifaBase: number;         // standard price pre-filled
  tarifaAjustada: number;     // client-adjusted price

  // For implementation cards
  disenioSitio: number;
  direccionObra: number;

  // Workers
  diasCarlos: number;           // Carlos: 200k/day fixed
  numAyudantes: number;
  diasAyudantes: number;        // ayudantes: 130k/day
  diasPastrana: number;         // Pastrana: 130k/day
  trabajadoresOtros: LineaPresupuesto[];

  // Plants
  plantas: LineaPlanta[];

  // Materials
  bocashiBultos: number;
  bocashiPrecioUnitario: number;
  fertilizantesTotal: number;
  microorganismosKg: number;
  microorganismosPrecioUnitario: number;
  insumosOtros: LineaPresupuesto[];

  // Logistics
  logistica: LineaPresupuesto[];

  // Viáticos
  viaticos: ViaticosData | null;

  // Sofia (design cost, fixed per card type)
  sofiaFee: number;

  // Esteban commission
  estebanAplica: boolean;
  estebanPorcentaje: number; // default 10

  notas: string;
}

// ── Financial summary (computed, stored for quick reads) ─────────
export interface ResumenFinanciero {
  totalFacturado: number;
  totalCobrado: number;
  totalGastos: number;
  utilidadBruta: number;
  comisionEsteban: number;
  utilidadAndres: number;
}

// ── Estado de pago ───────────────────────────────────────────────
export const ESTADOS_PAGO_PROYECTO = [
  'sin_presupuesto',
  'presupuestado',
  'parcialmente_pagado',
  'pagado',
  'cerrado'
] as const;
export type EstadoPagoProyecto = typeof ESTADOS_PAGO_PROYECTO[number];

// ── Main Proyecto document ───────────────────────────────────────
export interface Proyecto {
  id?: string;
  clienteId: string;         // Kanban card id
  contactoId: string;
  nombreCliente: string;     // denormalized
  categoria: CategoriaCliente;
  estadoPago: EstadoPagoProyecto;
  presupuesto: PresupuestoInterno;
  pagos: Pago[];
  gastos: Gasto[];
  resumen: ResumenFinanciero;
  creadoEn: Date;
  actualizadoEn: Date;
}

// ── Municipio Viáticos seed/config ──────────────────────────────
export interface MunicipioViatico {
  id?: string;
  nombre: string;
  kmIdaVuelta: number;
  numPeajesIdaVuelta: number;  // total count both ways
  costoPeajesTotalRT: number;  // sum of all peaje costs round trip
  tasaGasolinaPorKm: number;   // COP per km (configurable, default 1200)
  gastoGasolina: number;       // computed: kmIdaVuelta * tasaGasolinaPorKm
  total: number;               // gastoGasolina + costoPeajesTotalRT
  orden: number;
}

// ── Standard prices by category ─────────────────────────────────
export const PRECIOS_ESTANDAR: Partial<Record<CategoriaCliente, { tarifa: number; sofiaFee: number }>> = {
  'Visita Técnica':    { tarifa: 500_000,   sofiaFee: 0 },
  'Diseño Conceptual': { tarifa: 1_000_000, sofiaFee: 250_000 },
  'Diseño Técnico':    { tarifa: 2_000_000, sofiaFee: 500_000 },
  'Implementación':    { tarifa: 0,         sofiaFee: 0 },
};

export const TARIFA_CARLOS_DIA = 200_000;
export const TARIFA_AYUDANTE_DIA = 130_000;
export const TARIFA_PASTRANA_DIA = 130_000;
export const TASA_GASOLINA_POR_KM = 1_200;
export const ESTEBAN_PORCENTAJE_DEFAULT = 10;

export function calcularSubtotal(p: PresupuestoInterno): number {
  const trabajoBase = p.tarifaAjustada > 0
    ? p.tarifaAjustada
    : (p.disenioSitio + p.direccionObra);

  const manoObra =
    p.diasCarlos * TARIFA_CARLOS_DIA +
    p.numAyudantes * p.diasAyudantes * TARIFA_AYUDANTE_DIA +
    p.diasPastrana * TARIFA_PASTRANA_DIA +
    p.trabajadoresOtros.reduce((s, l) => s + l.subtotal, 0);

  const plantas = p.plantas.reduce((s, l) => s + l.subtotal, 0);

  const insumos =
    p.bocashiBultos * p.bocashiPrecioUnitario +
    p.fertilizantesTotal +
    p.microorganismosKg * p.microorganismosPrecioUnitario +
    p.insumosOtros.reduce((s, l) => s + l.subtotal, 0);

  const logistica = p.logistica.reduce((s, l) => s + l.subtotal, 0);
  const viaticos = p.viaticos?.total ?? 0;

  return trabajoBase + manoObra + plantas + insumos + logistica + viaticos;
}

export function calcularResumen(
  presupuesto: PresupuestoInterno,
  pagos: Pago[],
  gastos: Gasto[]
): ResumenFinanciero {
  const totalFacturado = calcularSubtotal(presupuesto);
  const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.subtotal, 0) + presupuesto.sofiaFee;
  const utilidadBruta = totalFacturado - totalGastos;
  const comisionEsteban = presupuesto.estebanAplica
    ? Math.round(utilidadBruta * presupuesto.estebanPorcentaje / 100)
    : 0;
  const utilidadAndres = utilidadBruta - comisionEsteban;
  return { totalFacturado, totalCobrado, totalGastos, utilidadBruta, comisionEsteban, utilidadAndres };
}

export function presupuestoVacio(categoria: CategoriaCliente): PresupuestoInterno {
  const std = PRECIOS_ESTANDAR[categoria];
  return {
    tarifaBase:    std?.tarifa ?? 0,
    tarifaAjustada: std?.tarifa ?? 0,
    disenioSitio:  0,
    direccionObra: 0,
    diasCarlos:    0,
    numAyudantes:  0,
    diasAyudantes: 0,
    diasPastrana:  0,
    trabajadoresOtros: [],
    plantas:       [],
    bocashiBultos: 0,
    bocashiPrecioUnitario: 30_000,
    fertilizantesTotal: 0,
    microorganismosKg: 0,
    microorganismosPrecioUnitario: 10_000,
    insumosOtros:  [],
    logistica:     [],
    viaticos:      null,
    sofiaFee:      std?.sofiaFee ?? 0,
    estebanAplica: false,
    estebanPorcentaje: ESTEBAN_PORCENTAJE_DEFAULT,
    notas:         '',
  };
}
