export const TIPOS_SERVICIO = [
  'asesoria_online',
  'asesoria_in_situ',
  'informe_vision',
  'fase_ruta1',
  'gran_escala_ruta2',
] as const;
export type TipoServicio = typeof TIPOS_SERVICIO[number];

export const TIPOS_SERVICIO_LABELS: Record<TipoServicio, string> = {
  asesoria_online:    'Asesoría Online',
  asesoria_in_situ:   'Asesoría In-Situ',
  informe_vision:     'Informe de Visión / Conceptual',
  fase_ruta1:         'Ruta 1 — Implementación por Fases',
  gran_escala_ruta2:  'Ruta 2 — Diseño Gran Escala',
};

export const RUBROS = ['diseno', 'direccion_obra', 'mano_obra', 'insumos', 'logistica'] as const;
export type Rubro = typeof RUBROS[number];

export const RUBROS_LABELS: Record<Rubro, string> = {
  diseno:         'Diseño',
  direccion_obra: 'Dirección de Obra',
  mano_obra:      'Mano de Obra',
  insumos:        'Insumos',
  logistica:      'Logística',
};

export interface ComponenteServicio {
  nombre: string;
  rubro: Rubro;
  unidad: string;
  precioUnitario: number;
  cantidadDefault?: number;
  notas?: string;
}

export type PrecioServicio =
  | { modo: 'fijo';   valor: number }
  | { modo: 'rango';  min: number; max: number }
  | { modo: 'por_m2'; valorPorM2: number; minimoFacturable?: number };

export interface Servicio {
  id?: string;
  tipo: TipoServicio;
  nombre: string;
  descripcion: string;
  queIncluye: string;
  queHaceElNegocio: string;
  precio: PrecioServicio;
  componentes: ComponenteServicio[];
  activo: boolean;
  orden: number;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: string;
}

export interface FirestoreServicio {
  id: string;
  tipo: TipoServicio;
  nombre: string;
  descripcion: string;
  queIncluye: string;
  queHaceElNegocio: string;
  precio: PrecioServicio;
  componentes?: ComponenteServicio[];
  activo: boolean;
  orden: number;
  creadoEn: { toDate(): Date } | null;
  actualizadoEn: { toDate(): Date } | null;
  creadoPor: string;
}

export function formatPrecio(precio: PrecioServicio): string {
  const cop = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n);

  switch (precio.modo) {
    case 'fijo':
      return `${cop(precio.valor)} COP`;
    case 'rango':
      if (precio.min === 0 && precio.max === 0) return 'Cotización por fase';
      return `Entre ${cop(precio.min)} y ${cop(precio.max)} COP (según intensidad)`;
    case 'por_m2':
      return `${cop(precio.valorPorM2)} COP/m² (cotización por área del lote)`;
  }
}
