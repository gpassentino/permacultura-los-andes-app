// Lógica pura del tablero: filtros, agrupación, indicadores y orden de la lista.

import {
  ETAPAS_EJECUCION,
  ETAPAS_FLUJO,
  EtapaEjecucion,
  EtapaFlujo,
  ProyectoFlujo,
} from '../models/proyecto-flujo.model';
import { diasEnEtapa, estaEstancado } from './flujo';

export interface FiltrosTablero {
  texto: string;
  servicioId: string | null;
  soloEstancados: boolean;
}

export const FILTROS_VACIOS: FiltrosTablero = { texto: '', servicioId: null, soloEstancados: false };

/** Etapas que no cuentan como trabajo activo. */
export const ETAPAS_CERRADAS: readonly EtapaFlujo[] = ['archivado', 'no_se_dio'];

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Busca por nombre del proyecto, código o nombre del contacto. */
export function coincideTexto(p: Pick<ProyectoFlujo, 'nombreProyecto' | 'codigo'>, nombreContacto: string, texto: string): boolean {
  const q = normalizar(texto);
  if (!q) return true;
  return [p.nombreProyecto, p.codigo, nombreContacto].some(c => normalizar(c ?? '').includes(q));
}

export function filtrarProyectos<P extends ProyectoFlujo>(
  proyectos: readonly P[],
  f: FiltrosTablero,
  nombreContacto: (p: P) => string,
  ahora: Date,
): P[] {
  return proyectos.filter(p =>
    coincideTexto(p, nombreContacto(p), f.texto)
    && (!f.servicioId || p.servicioIds.includes(f.servicioId))
    && (!f.soloEstancados || estaEstancado(p, ahora)),
  );
}

/** Ordena por más días en la etapa primero (lo más atascado arriba). */
function porAntiguedad<P extends ProyectoFlujo>(carril: 'diseno' | 'ejecucion', ahora: Date) {
  return (a: P, b: P) => (diasEnEtapa(b, ahora, carril) ?? 0) - (diasEnEtapa(a, ahora, carril) ?? 0);
}

export function agruparDiseno<P extends ProyectoFlujo>(proyectos: readonly P[], ahora: Date): Map<EtapaFlujo, P[]> {
  const m = new Map<EtapaFlujo, P[]>(ETAPAS_FLUJO.map(e => [e, []]));
  for (const p of proyectos) m.get(p.etapaFlujo)?.push(p);
  for (const lista of m.values()) lista.sort(porAntiguedad('diseno', ahora));
  return m;
}

export function agruparEjecucion<P extends ProyectoFlujo>(proyectos: readonly P[], ahora: Date): Map<EtapaEjecucion, P[]> {
  const m = new Map<EtapaEjecucion, P[]>(ETAPAS_EJECUCION.map(e => [e, []]));
  for (const p of proyectos) if (p.etapaEjecucion) m.get(p.etapaEjecucion)?.push(p);
  for (const lista of m.values()) lista.sort(porAntiguedad('ejecucion', ahora));
  return m;
}

export interface IndicadoresTablero {
  propuestasAbiertas: number;
  enDiseno: number;
  estancados: number;
}

export function indicadores(proyectos: readonly ProyectoFlujo[], ahora: Date): IndicadoresTablero {
  return {
    propuestasAbiertas: proyectos.filter(p => p.etapaFlujo === 'propuesta').length,
    enDiseno:           proyectos.filter(p => p.etapaFlujo === 'diseno' || p.etapaFlujo === 'revision').length,
    estancados:         proyectos.filter(p => estaEstancado(p, ahora)).length,
  };
}

// ── Lista ordenable ──────────────────────────────────────────────────────────

export type CampoOrden = 'codigo' | 'proyecto' | 'etapa' | 'dias' | 'proximoPaso' | 'valor' | 'pagado';

export interface FilaLista {
  id: string;
  codigo: string;
  proyecto: string;
  contacto: string;
  etapa: EtapaFlujo;
  etapaEjecucion: EtapaEjecucion | null;
  servicios: string;
  dias: number;
  proximoPaso: string;
  proximoPasoFecha: Date | null;
  valor: number | null;
  pagado: number | null;
}

const ORDEN_ETAPA = new Map<string, number>(ETAPAS_FLUJO.map((e, i) => [e, i]));

export function ordenarFilas(filas: readonly FilaLista[], campo: CampoOrden, asc: boolean): FilaLista[] {
  const dir = asc ? 1 : -1;
  const valor = (f: FilaLista): string | number => {
    switch (campo) {
      case 'codigo':      return f.codigo;
      case 'proyecto':    return normalizar(f.proyecto);
      case 'etapa':       return ORDEN_ETAPA.get(f.etapa) ?? 99;
      case 'dias':        return f.dias;
      // Sin fecha va al final en orden ascendente
      case 'proximoPaso': return f.proximoPasoFecha?.getTime() ?? Number.MAX_SAFE_INTEGER;
      case 'valor':       return f.valor ?? -1;
      case 'pagado':      return f.pagado ?? -1;
    }
  };
  return [...filas].sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.codigo.localeCompare(b.codigo);
  });
}
