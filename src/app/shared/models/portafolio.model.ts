export const TIPOS_PROYECTO_PORTAFOLIO = [
  'finca',
  'hogar',
  'parque',
  'parcelacion',
  'comercial',
  'otro',
] as const;
export type TipoProyectoPortafolio = typeof TIPOS_PROYECTO_PORTAFOLIO[number];

export const TIPOS_PROYECTO_PORTAFOLIO_LABELS: Record<TipoProyectoPortafolio, string> = {
  finca:        'Finca',
  hogar:        'Hogar',
  parque:       'Parque',
  parcelacion:  'Parcelación',
  comercial:    'Comercial',
  otro:         'Otro',
};

export interface FotoPortafolio {
  url: string;
  storagePath: string;
  caption?: string;
}

export interface ProyectoPortafolio {
  id?: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  anio: number;
  tipoProyecto: TipoProyectoPortafolio;
  fotos: FotoPortafolio[];
  fotoPortadaIndex: number;
  destacado: boolean;
  orden: number;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}

export interface FirestorePortafolioProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  anio: number;
  tipoProyecto: TipoProyectoPortafolio;
  fotos: FotoPortafolio[];
  fotoPortadaIndex: number;
  destacado: boolean;
  orden: number;
  activo: boolean;
  creadoEn: { toDate(): Date } | null;
  actualizadoEn: { toDate(): Date } | null;
  creadoPor: string;
}

export const MAX_FOTOS_POR_PROYECTO = 10;
