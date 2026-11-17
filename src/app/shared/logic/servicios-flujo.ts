// Plan idempotente para que el catálogo `servicios` tenga lo que el flujo
// necesita, sin duplicar ni tocar entradas existentes (salvo el renombre
// acordado de `informe_vision` → "Diseño conceptual", conservando su id).

import {
  NOMBRE_DISENO_CONCEPTUAL,
  PrecioServicio,
  TIPOS_SERVICIO_FLUJO,
  TipoServicio,
} from '../models/servicio.model';

export interface ServicioExistente {
  id: string;
  tipo: string;
  nombre: string;
  orden?: number;
  activo?: boolean;
}

export interface ServicioNuevo {
  tipo: TipoServicio;
  nombre: string;
  descripcion: string;
  queIncluye: string;
  queHaceElNegocio: string;
  precio: PrecioServicio;
  componentes: [];
  activo: boolean;
  orden: number;
}

export interface PlanServicios {
  crear: ServicioNuevo[];
  renombrar: { id: string; de: string; a: string }[];
  /** Id del documento por tipo; para los que se van a crear, `nuevo:<tipo>`. */
  idPorTipo: Record<string, string>;
  avisos: string[];
}

const PRECIO_POR_COTIZAR: PrecioServicio = { modo: 'rango', min: 0, max: 0 };

/** Datos para crear las entradas que falten. Las descripciones son un borrador para completar. */
const PLANTILLAS: Record<(typeof TIPOS_SERVICIO_FLUJO)[number], Omit<ServicioNuevo, 'orden'>> = {
  asesoria_in_situ: {
    tipo: 'asesoria_in_situ', nombre: 'Diagnóstico y visita técnica',
    descripcion: 'Visita al predio para leer el sitio y diagnosticar.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
  informe_vision: {
    tipo: 'informe_vision', nombre: NOMBRE_DISENO_CONCEPTUAL,
    descripcion: 'Diseño conceptual del predio.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
  diseno_tecnico: {
    tipo: 'diseno_tecnico', nombre: 'Diseño técnico',
    descripcion: 'Planos técnicos y dossier para ejecutar el diseño.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
  ejecucion: {
    tipo: 'ejecucion', nombre: 'Ejecución',
    descripcion: 'Implementación en obra del diseño.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
  acompanamiento: {
    tipo: 'acompanamiento', nombre: 'Acompañamiento',
    descripcion: 'Acompañamiento técnico durante la ejecución o el mantenimiento.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
  taller: {
    tipo: 'taller', nombre: 'Taller',
    descripcion: 'Taller de formación.',
    queIncluye: '', queHaceElNegocio: '', precio: PRECIO_POR_COTIZAR, componentes: [], activo: true,
  },
};

export function planServicios(existentes: readonly ServicioExistente[]): PlanServicios {
  const plan: PlanServicios = { crear: [], renombrar: [], idPorTipo: {}, avisos: [] };
  let siguienteOrden = existentes.reduce((m, s) => Math.max(m, s.orden ?? 0), 0) + 1;

  for (const tipo of TIPOS_SERVICIO_FLUJO) {
    const delTipo = existentes
      .filter(s => s.tipo === tipo)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    if (delTipo.length === 0) {
      plan.crear.push({ ...PLANTILLAS[tipo], orden: siguienteOrden++ });
      plan.idPorTipo[tipo] = `nuevo:${tipo}`;
      continue;
    }

    const elegido = delTipo[0];
    plan.idPorTipo[tipo] = elegido.id;
    if (delTipo.length > 1) {
      plan.avisos.push(`Hay ${delTipo.length} servicios de tipo "${tipo}"; se usa "${elegido.nombre}" (${elegido.id}).`);
    }
    if (elegido.activo === false) {
      plan.avisos.push(`El servicio "${elegido.nombre}" (${tipo}) está inactivo.`);
    }
    if (tipo === 'informe_vision' && elegido.nombre !== NOMBRE_DISENO_CONCEPTUAL) {
      plan.renombrar.push({ id: elegido.id, de: elegido.nombre, a: NOMBRE_DISENO_CONCEPTUAL });
    }
  }
  return plan;
}
