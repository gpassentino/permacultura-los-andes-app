export const ESTADOS_CLIENTE = [
  'Antes',
  'Durante',
  'Después',
  'Completo',
  'Archivado'
] as const;

export type EstadoCliente = typeof ESTADOS_CLIENTE[number];

export const CATEGORIAS_CLIENTE = [
  'Visita Técnica',
  'Diseño Conceptual',
  'Diseño Técnico',
  'Implementación',
  'Indefinido',
  'Otro'
] as const;

export type CategoriaCliente = typeof CATEGORIAS_CLIENTE[number];

export const FASES_CHECKLIST = ['antes', 'durante', 'después'] as const;
export type FaseChecklist = typeof FASES_CHECKLIST[number];

export interface ChecklistItem {
  texto: string;
  fase: FaseChecklist;
  completado: boolean;
  completadoEn?: Date | null;
  completadoPor?: string;
}

export interface DocumentoLink {
  label: string;
  url: string;
}

export interface Cliente {
  id?: string;
  contactoId: string;
  nombre: string;             // denormalized snapshot of Contacto.name
  categoria: CategoriaCliente;
  checklist: ChecklistItem[];
  municipio: string;
  whatsapp: string;           // denormalized snapshot of Contacto.phone
  fechaUltimoContacto: Date | null;
  fechaEstimadaInicio: Date | null;
  notas: string;
  documentos: DocumentoLink[];
  recordatorioFecha: Date | null;
  recordatorioMensaje: string;
  estado: EstadoCliente;
  creadoEn: Date;
  creadoPor: string;
  actualizadoEn: Date;
}

export interface FirestoreChecklistItem {
  texto: string;
  fase: FaseChecklist;
  completado: boolean;
  completadoEn?: { toDate(): Date } | null;
  completadoPor?: string;
}

export interface FirestoreCliente {
  id: string;
  contactoId?: string;
  nombre: string;
  categoria: CategoriaCliente;
  checklist?: FirestoreChecklistItem[];
  municipio: string;
  whatsapp: string;
  fechaUltimoContacto: { toDate(): Date } | null;
  fechaEstimadaInicio: { toDate(): Date } | null;
  notas: string;
  documentos: DocumentoLink[];
  recordatorioFecha: { toDate(): Date } | null;
  recordatorioMensaje: string;
  estado: EstadoCliente;
  creadoEn: { toDate(): Date } | null;
  creadoPor: string;
  actualizadoEn: { toDate(): Date } | null;
}

// ── Checklist templates per categoría ──────────────────────────
// Seed data, copied into Cliente.checklist[] when the categoría is set.
// Editing these here only affects newly-created/re-categorized cards.
export const CHECKLIST_TEMPLATES: Record<CategoriaCliente, Omit<ChecklistItem, 'completado' | 'completadoEn' | 'completadoPor'>[]> = {
  'Visita Técnica': [
    { texto: 'Reunión con Carlos',                       fase: 'antes' },
    { texto: 'Formato de checklist en campo listo',      fase: 'antes' },
    { texto: 'Contrato de visita técnica firmado',       fase: 'antes' },
    { texto: 'Llevar metro / cámara / GPS',              fase: 'antes' },
    { texto: 'Tomar fotos',                              fase: 'durante' },
    { texto: 'Medir contornos',                          fase: 'durante' },
    { texto: 'Anotar estado de vegetación',              fase: 'durante' },
    { texto: 'Capturar dirección + GPS',                 fase: 'durante' },
    { texto: 'Tomar notas',                              fase: 'durante' },
    { texto: 'Subir fotos al app/Drive',                 fase: 'después' },
    { texto: 'Preparar formato de informe técnico',      fase: 'después' },
    { texto: 'Presentar hallazgos al cliente',           fase: 'después' },
    { texto: 'Preparar presupuesto para diseño conceptual', fase: 'después' },
  ],
  'Diseño Conceptual': [
    { texto: 'Contrato de diseño conceptual firmado',                    fase: 'antes' },
    { texto: 'Contactar a Sofi (dibujante)',                             fase: 'antes' },
    { texto: 'Recolectar insumos en Drive (mapas, satelital, AutoCAD, fotos)', fase: 'antes' },
    { texto: 'Esquemas + análisis de sitio',                             fase: 'durante' },
    { texto: 'Diagramas',                                                fase: 'durante' },
    { texto: 'Concepto',                                                 fase: 'durante' },
    { texto: 'Planta de conjunto inicial',                               fase: 'durante' },
    { texto: 'Narrativa',                                                fase: 'durante' },
    { texto: 'Presentación al cliente',                                  fase: 'después' },
    { texto: 'Preparar presupuesto para diseño técnico',                 fase: 'después' },
  ],
  'Diseño Técnico': [
    { texto: 'Contrato de diseño técnico firmado',         fase: 'antes' },
    { texto: 'Anteproyecto aprobado',                      fase: 'antes' },
    { texto: 'Briefing técnico con Sofi',                  fase: 'antes' },
    { texto: 'Proyecto básico: plantas dimensionadas',     fase: 'durante' },
    { texto: 'Proyecto básico: cortes/secciones',          fase: 'durante' },
    { texto: 'Proyecto básico: renders',                   fase: 'durante' },
    { texto: 'Proyecto ejecutivo: planos de replanteo',    fase: 'durante' },
    { texto: 'Proyecto ejecutivo: plano hídrico',          fase: 'durante' },
    { texto: 'Proyecto ejecutivo: plano de plantación',    fase: 'durante' },
    { texto: 'Proyecto ejecutivo: detalles de construcción', fase: 'durante' },
    { texto: 'Entrega de planos al cliente',               fase: 'después' },
    { texto: 'Preparar presupuesto + cronograma de implementación', fase: 'después' },
  ],
  'Implementación': [
    { texto: 'Contrato de implementación firmado',                fase: 'antes' },
    { texto: 'Presupuesto y cronograma aprobados',                fase: 'antes' },
    { texto: 'Selección de material',                             fase: 'antes' },
    { texto: 'Contratos con proveedores y jardineros',            fase: 'antes' },
    { texto: 'Coordinar transporte',                              fase: 'antes' },
    { texto: 'Establecimiento (la obra)',                         fase: 'durante' },
    { texto: 'Reuniones con Carlos/jefe',                         fase: 'durante' },
    { texto: 'Manuales/instrucciones de mantenimiento en preparación', fase: 'durante' },
    { texto: 'Entrega final',                                     fase: 'después' },
    { texto: 'Manual de mantenimiento al cliente',                fase: 'después' },
    { texto: 'Cobranza completa',                                 fase: 'después' },
    { texto: 'Preparar propuesta de mantenimiento',               fase: 'después' },
  ],
  'Indefinido': [],
  'Otro': [],
};

export function buildChecklistFromTemplate(categoria: CategoriaCliente): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[categoria].map(item => ({
    ...item,
    completado: false,
    completadoEn: null,
  }));
}

// Next-categoría progression for the "Continuar con siguiente fase" flow
export const NEXT_CATEGORIA: Partial<Record<CategoriaCliente, CategoriaCliente>> = {
  'Visita Técnica':    'Diseño Conceptual',
  'Diseño Conceptual': 'Diseño Técnico',
  'Diseño Técnico':    'Implementación',
  // Implementación → null (Mantenimiento lives in Calendar, not Tablero)
};

// Color-coded badge class for a categoría — used in cliente-card and contacto-detalle deeplinks
export function categoriaBadgeClass(categoria: CategoriaCliente): string {
  const map: Record<CategoriaCliente, string> = {
    'Visita Técnica':    'cat-visita',
    'Diseño Conceptual': 'cat-conceptual',
    'Diseño Técnico':    'cat-tecnico',
    'Implementación':    'cat-implementacion',
    'Indefinido':        'cat-indefinido',
    'Otro':              'cat-otro',
  };
  return map[categoria];
}
