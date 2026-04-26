// ── Status / label constants ──────────────────────────────────────────────────

export const ESTADOS_CONTACTO = [
  'nuevo_mensaje',
  'interesado',
  'lead',
  'cliente',
  'sin_respuesta'
] as const;

export type EstadoContacto = typeof ESTADOS_CONTACTO[number];

export const ESTADOS_CONTACTO_LABELS: Record<EstadoContacto, string> = {
  nuevo_mensaje: 'Nuevo Mensaje',
  interesado:    'Interesado',
  lead:          'Lead',
  cliente:       'Cliente',
  sin_respuesta: 'Sin Respuesta'
};

export const TIPOS_NEGOCIO = [
  'paisajismo',
  'academia',
  'proveedor',
  'general'
] as const;

export type TipoNegocio = typeof TIPOS_NEGOCIO[number];

export const TIPOS_NEGOCIO_LABELS: Record<TipoNegocio, string> = {
  paisajismo: 'Paisajismo',
  academia:   'Academia',
  proveedor:  'Proveedor',
  general:    'General'
};

export const WHATSAPP_LABELS = [
  'NM',
  'IN',
  'LD',
  'CL',
  'SR',
  'NM | Paisajismo',
  'IN | Paisajismo',
  'LD | Paisajismo',
  'CL | Paisajismo',
  'SR | Paisajismo',
  'NM | Academia',
  'IN | Academia',
  'LD | Academia',
  'CL | Academia',
  'SR | Academia',
  'Proveedor'
] as const;

export type WhatsAppLabel = typeof WHATSAPP_LABELS[number];

export const MUNICIPIOS = [
  'El Retiro',
  'La Ceja',
  'Rionegro',
  'Las Palmas',
  'Guarne',
  'Santa Elena',
  'Envigado',
  'Copacabana',
  'Barbosa',
  'Girardota',
  'Medellín',
  'Otro'
] as const;

export type Municipio = typeof MUNICIPIOS[number];

// ── Main interfaces ───────────────────────────────────────────────────────────

export interface ContactoLocation {
  city?: string;
  coordinates?: { lat: number; lng: number };
  address?: string;
}

export interface AcademiaHistory {
  completedTalleres: string[];    // taller IDs
  interestedTalleres: string[];
  preferredSchedule?: 'weekday' | 'weekend' | 'evening';
}

export interface Contacto {
  id?: string;
  phone: string;
  normalizedPhone: string;
  name: string;
  whatsappLabel: WhatsAppLabel;
  businessTypes: TipoNegocio[];
  status: EstadoContacto;
  location: ContactoLocation;
  kanbanCardIds: string[];
  academiaHistory?: AcademiaHistory;
  notas?: string;
  createdAt: Date;
  lastMessageAt: Date;
  lastSyncAt: Date;
}

// Firestore version (Timestamps become objects with toDate())
export interface FirestoreContacto {
  id: string;
  phone: string;
  normalizedPhone: string;
  name: string;
  whatsappLabel: WhatsAppLabel;
  businessTypes: TipoNegocio[];
  status: EstadoContacto;
  location: ContactoLocation;
  kanbanCardIds?: string[];
  academiaHistory?: AcademiaHistory;
  notas?: string;
  createdAt: { toDate(): Date } | null;
  lastMessageAt: { toDate(): Date } | null;
  lastSyncAt: { toDate(): Date } | null;
}

// ── WhatsApp message sub-collection ──────────────────────────────────────────

export const MESSAGE_TYPES = ['text', 'image', 'location', 'document'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

export interface WhatsAppMessage {
  id?: string;
  text: string;
  timestamp: Date;
  fromContact: boolean;
  messageType: MessageType;
  mediaUrl?: string;
}

export interface FirestoreWhatsAppMessage {
  id: string;
  text: string;
  timestamp: { toDate(): Date } | null;
  fromContact: boolean;
  messageType: MessageType;
  mediaUrl?: string;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const STATUS_BADGE_CLASS: Record<EstadoContacto, string> = {
  nuevo_mensaje: 'badge-status-nm',
  interesado:    'badge-status-in',
  lead:          'badge-status-ld',
  cliente:       'badge-status-cl',
  sin_respuesta: 'badge-status-sr'
};

export const TIPO_NEGOCIO_ICON: Record<TipoNegocio, string> = {
  paisajismo: '🌿',
  academia:   '🎓',
  proveedor:  '🏭',
  general:    '👤'
};
