// ── Proyecto del flujo (colección `proyectosFlujo`) ──────────────────────────
// Cada tarjeta del tablero es un proyecto: un predio o encargo. El lado
// financiero (presupuesto, pagos, hitos de cobro) vive aparte, en `proyectos`,
// restringido a los usuarios de Contabilidad, y se enlaza con
// `proyectoFinancieroId`.
//
// Los datos de contacto NO se copian aquí: se leen de `contacts` por
// `contactoId`. Para los proyectos migrados, la copia que ya existe en
// `clientes` (enlazada por `clienteIdLegacy`) sirve de respaldo.

// ── Etapas del carril de diseño ──────────────────────────────────────────────

export const ETAPAS_FLUJO = [
  'contacto',
  'propuesta',
  'contrato',
  'diseno',
  'revision',
  'entregado',
  'portafolio',
  'archivado',
  'no_se_dio',
] as const;
export type EtapaFlujo = typeof ETAPAS_FLUJO[number];

export const ETAPAS_FLUJO_LABELS: Record<EtapaFlujo, string> = {
  contacto:   'Contacto',
  propuesta:  'Propuesta',
  contrato:   'Contrato',
  diseno:     'Diseño',
  revision:   'Revisión',
  entregado:  'Entregado',
  portafolio: 'Portafolio',
  archivado:  'Archivado',
  no_se_dio:  'No se dio',
};

export type FaseFlujo = 'vender' | 'firmar' | 'disenar' | 'cerrar';

export interface FaseFlujoDef {
  id: FaseFlujo;
  label: string;
  color: 'ambar' | 'morado' | 'verde' | 'gris';
  etapas: readonly EtapaFlujo[];
}

/** Fases de color del tablero. `no_se_dio` queda fuera del flujo. */
export const FASES_FLUJO: readonly FaseFlujoDef[] = [
  { id: 'vender',  label: 'Vender',  color: 'ambar',  etapas: ['contacto', 'propuesta'] },
  { id: 'firmar',  label: 'Firmar',  color: 'morado', etapas: ['contrato'] },
  { id: 'disenar', label: 'Diseñar', color: 'verde',  etapas: ['diseno', 'revision', 'entregado'] },
  { id: 'cerrar',  label: 'Cerrar',  color: 'gris',   etapas: ['portafolio', 'archivado'] },
];

export function faseDeEtapa(etapa: EtapaFlujo): FaseFlujoDef | null {
  return FASES_FLUJO.find(f => f.etapas.includes(etapa)) ?? null;
}

// ── Carril de ejecución ──────────────────────────────────────────────────────

export const ETAPAS_EJECUCION = [
  'por_programar',
  'en_obra',
  'mantenimiento',
  'ejecucion_cerrada',
] as const;
export type EtapaEjecucion = typeof ETAPAS_EJECUCION[number];

export const ETAPAS_EJECUCION_LABELS: Record<EtapaEjecucion, string> = {
  por_programar:     'Por programar',
  en_obra:           'En obra',
  mantenimiento:     'Mantenimiento',
  ejecucion_cerrada: 'Ejecución cerrada',
};

export type Carril = 'diseno' | 'ejecucion';

// ── Cierre sin venta ─────────────────────────────────────────────────────────

export const MOTIVOS_CIERRE = [
  'precio',
  'tiempos',
  'se_fue_con_otro',
  'no_respondio',
  'otro',
] as const;
export type MotivoCierre = typeof MOTIVOS_CIERRE[number];

export const MOTIVOS_CIERRE_LABELS: Record<MotivoCierre, string> = {
  precio:          'Precio',
  tiempos:         'Tiempos',
  se_fue_con_otro: 'Se fue con otro',
  no_respondio:    'No respondió',
  otro:            'Otro',
};

// ── Visita técnica ───────────────────────────────────────────────────────────

export const ESTADOS_VISITA = ['no_aplica', 'pendiente', 'programada', 'hecha'] as const;
export type EstadoVisita = typeof ESTADOS_VISITA[number];

export const ESTADOS_VISITA_LABELS: Record<EstadoVisita, string> = {
  no_aplica:  'No aplica',
  pendiente:  'Pendiente',
  programada: 'Programada',
  hecha:      'Hecha',
};

// ── Documentos ───────────────────────────────────────────────────────────────

export const TIPOS_DOCUMENTO = [
  'cotizacion',
  'contrato',
  'otrosi',
  'acta_visita',
  'informe',
  'dossier',
  'reel',
  'otro',
] as const;
export type TipoDocumento = typeof TIPOS_DOCUMENTO[number];

export const TIPOS_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  cotizacion:  'Cotización',
  contrato:    'Contrato',
  otrosi:      'Otrosí',
  acta_visita: 'Acta de visita',
  informe:     'Informe',
  dossier:     'Dossier',
  reel:        'Reel',
  otro:        'Otro',
};

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  /** Etapa (de diseño o ejecución) en la que se adjuntó. */
  etapa: string;
  /** Enlace de Google Drive (lo normal) o URL de Storage (escaneos firmados). */
  url: string;
  /** "v1", "v2"… */
  version?: string;
  fecha: Date;
  nota?: string;
}

/**
 * Casillas de documentos esperados por etapa (pestaña Documentos de la ficha).
 * `soloSiVisita`: la casilla solo aplica si la visita técnica aplica.
 */
export interface CasillaDocumento {
  etapa: EtapaFlujo;
  tipo: TipoDocumento;
  label: string;
  soloSiVisita?: boolean;
  conVersion?: boolean;
}

export const CASILLAS_DOCUMENTO: readonly CasillaDocumento[] = [
  { etapa: 'propuesta',  tipo: 'cotizacion',  label: 'Cotización' },
  { etapa: 'contrato',   tipo: 'contrato',    label: 'Contrato firmado' },
  { etapa: 'diseno',     tipo: 'acta_visita', label: 'Acta de visita', soloSiVisita: true },
  { etapa: 'revision',   tipo: 'informe',     label: 'Informe',        conVersion: true },
  { etapa: 'entregado',  tipo: 'dossier',     label: 'Dossier' },
  { etapa: 'portafolio', tipo: 'reel',        label: 'Reel' },
];

// ── Historial ────────────────────────────────────────────────────────────────

export interface EntradaHistorial {
  etapa: string;
  carril: Carril;
  desde: Date;
  hasta?: Date;
  /** Texto libre opcional, p. ej. "Siguiente fase: Diseño técnico". */
  nota?: string;
}

export interface ProximoPaso {
  texto: string;
  fecha?: Date;
}

// ── Documento principal ──────────────────────────────────────────────────────

export interface ProyectoFlujo {
  id?: string;
  contactoId: string;
  /** Registro de `clientes` del que vino en la migración (mismo id). */
  clienteIdLegacy?: string;
  /** Registro financiero en `proyectos` (solo Contabilidad), cuando exista. */
  proyectoFinancieroId?: string;
  /** "PLA-HRZ": 3 letras en mayúscula, único (reservado en `codigosProyecto`). */
  codigo: string;
  nombreProyecto: string;
  municipio?: string;
  areaHa?: number;

  etapaFlujo: EtapaFlujo;
  etapaFlujoDesde: Date;
  etapaEjecucion: EtapaEjecucion | null;
  etapaEjecucionDesde?: Date;

  servicioIds: string[];
  visitaTecnica: EstadoVisita;
  visitaFecha?: Date;
  proximoPaso?: ProximoPaso;
  documentos: Documento[];
  carpetaDriveUrl?: string;
  motivoCierre?: string;
  portafolioProyectoId?: string;
  notas?: string;
  historial: EntradaHistorial[];

  /** Puntos a revisar a mano (p. ej. tras la migración): 'nombre', 'codigo', 'servicios'… */
  revisar?: string[];

  creadoEn: Date;
  creadoPor: string;
  actualizadoEn: Date;
  migradoEn?: Date;
}

// ── Reglas de estancamiento ──────────────────────────────────────────────────

/**
 * Días máximos en cada etapa antes de marcar la tarjeta como estancada.
 * `contacto` solo cuenta si además no hay próximo paso.
 */
export const UMBRALES_ESTANCAMIENTO: Partial<Record<EtapaFlujo, number>> = {
  contacto:  7,
  propuesta: 15,
  contrato:  10,
  diseno:    45,
  revision:  20,
};

/** Etapa a la que vuelve un proyecto al agregar la siguiente fase de diseño. */
export const ETAPA_SIGUIENTE_FASE_DISENO: EtapaFlujo = 'diseno';
/** Etapa inicial del carril de ejecución al activarlo. */
export const ETAPA_INICIAL_EJECUCION: EtapaEjecucion = 'por_programar';
