export const ESTADOS_CLIENTE = [
  'Contacto Inicial',
  'Propuesta Enviada',
  'Presupuesto Aprobado',
  'En Ejecución',
  'Finalizado',
  'Archivado'
] as const;

export type EstadoCliente = typeof ESTADOS_CLIENTE[number];

export const TIPOS_PROYECTO = [
  'Paisajismo Regenerativo',
  'Diseño y Manejo del Agua',
  'Bosque Comestible',
  'Taller Presencial',
  'Consultoría',
  'Otro'
] as const;

export type TipoProyecto = typeof TIPOS_PROYECTO[number];

export interface DocumentoLink {
  label: string;
  url: string;
}

export interface Cliente {
  id?: string;
  nombre: string;
  tipoProyecto: TipoProyecto | '';
  municipio: string;
  whatsapp: string;
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

export interface FirestoreCliente {
  id: string;
  nombre: string;
  tipoProyecto: TipoProyecto | '';
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
