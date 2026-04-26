export const ESTADOS_TALLER = [
  'Próximo',
  'En Curso',
  'Finalizado',
  'Cancelado'
] as const;

export type EstadoTaller = typeof ESTADOS_TALLER[number];

export const COMO_NOS_CONOCIO_OPCIONES = [
  'WhatsApp',
  'Instagram',
  'Recomendación',
  'YouTube',
  'Otro'
] as const;

export type ComoNosConocio = typeof COMO_NOS_CONOCIO_OPCIONES[number];

// ── Taller ───────────────────────────────────────────────────────────

export interface Taller {
  id?: string;
  nombre: string;
  numero: number | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  ubicacion: string;
  municipio: string;
  cupoMaximo: number | null;
  precio: number | null;
  descripcion: string;
  estado: EstadoTaller;
  enlaceReserva: string;
  notasInternas: string;
  // Denormalized counters — updated on every participante write
  participantesCount: number;
  totalRecaudado: number;
  creadoEn: Date;
}

export interface FirestoreTaller {
  id: string;
  nombre: string;
  numero: number | null;
  fechaInicio: { toDate(): Date } | null;
  fechaFin: { toDate(): Date } | null;
  ubicacion: string;
  municipio: string;
  cupoMaximo: number | null;
  precio: number | null;
  descripcion: string;
  estado: EstadoTaller;
  enlaceReserva: string;
  notasInternas: string;
  participantesCount: number;
  totalRecaudado: number;
  creadoEn: { toDate(): Date } | null;
}

// ── Participante ─────────────────────────────────────────────────────

export interface Participante {
  id?: string;
  contactoId: string;
  nombreCompleto: string;       // denormalized snapshot of Contacto.name
  whatsapp: string;             // denormalized snapshot of Contacto.phone
  email: string;
  ciudadOrigen: string;
  comoNosConocio: ComoNosConocio | '';
  pago: boolean;
  montoPagado: number | null;
  notas: string;
  creadoEn: Date;
}

export interface FirestoreParticipante {
  id: string;
  contactoId?: string;
  nombreCompleto: string;
  whatsapp: string;
  email: string;
  ciudadOrigen: string;
  comoNosConocio: ComoNosConocio | '';
  pago: boolean;
  montoPagado: number | null;
  notas: string;
  creadoEn: { toDate(): Date } | null;
}
