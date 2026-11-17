// Lógica pura del flujo de proyectos (sin Angular ni Firebase), para que la
// usen el tablero, el servicio y el script de migración, y se pruebe con Vitest.

import {
  Carril,
  EntradaHistorial,
  EtapaEjecucion,
  EtapaFlujo,
  ETAPA_INICIAL_EJECUCION,
  ETAPA_SIGUIENTE_FASE_DISENO,
  ProyectoFlujo,
  UMBRALES_ESTANCAMIENTO,
} from '../models/proyecto-flujo.model';
import { formatoCOP } from '../utils/formato';

const MS_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Días completos de calendario entre dos fechas (nunca negativo). */
export function diasEntre(desde: Date, hasta: Date): number {
  const diff = inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime();
  return Math.max(0, Math.round(diff / MS_DIA));
}

type ProyectoEtapas = Pick<ProyectoFlujo,
  'etapaFlujo' | 'etapaFlujoDesde' | 'etapaEjecucion' | 'etapaEjecucionDesde' | 'proximoPaso'>;

/** Días que lleva el proyecto en su etapa actual del carril indicado. */
export function diasEnEtapa(p: ProyectoEtapas, ahora: Date, carril: Carril = 'diseno'): number | null {
  if (carril === 'ejecucion') {
    if (!p.etapaEjecucion || !p.etapaEjecucionDesde) return null;
    return diasEntre(p.etapaEjecucionDesde, ahora);
  }
  return diasEntre(p.etapaFlujoDesde, ahora);
}

/**
 * Alerta de estancamiento (borde rojo). Usa UMBRALES_ESTANCAMIENTO.
 * En `contacto` solo cuenta si además no hay próximo paso.
 */
export function estaEstancado(
  p: ProyectoEtapas,
  ahora: Date,
  umbrales: Partial<Record<EtapaFlujo, number>> = UMBRALES_ESTANCAMIENTO,
): boolean {
  const umbral = umbrales[p.etapaFlujo];
  if (umbral === undefined) return false;
  const dias = diasEnEtapa(p, ahora) ?? 0;
  if (dias <= umbral) return false;
  if (p.etapaFlujo === 'contacto') return !p.proximoPaso?.texto?.trim();
  return true;
}

/** El próximo paso tiene fecha y ya pasó (antes de hoy). */
export function proximoPasoVencido(p: Pick<ProyectoFlujo, 'proximoPaso'>, ahora: Date): boolean {
  const fecha = p.proximoPaso?.fecha;
  if (!fecha) return false;
  return inicioDelDia(fecha).getTime() < inicioDelDia(ahora).getTime();
}

// ── Movimientos ──────────────────────────────────────────────────────────────

/** Cierra la entrada abierta del carril y agrega la nueva. No muta. */
export function agregarAlHistorial(
  historial: readonly EntradaHistorial[],
  carril: Carril,
  etapa: string,
  ahora: Date,
  nota?: string,
): EntradaHistorial[] {
  const cerrado = historial.map(h =>
    h.carril === carril && !h.hasta ? { ...h, hasta: ahora } : h,
  );
  const nueva: EntradaHistorial = { etapa, carril, desde: ahora };
  if (nota) nueva.nota = nota;
  return [...cerrado, nueva];
}

type ProyectoMovible = Pick<ProyectoFlujo,
  'etapaFlujo' | 'etapaEjecucion' | 'historial' | 'servicioIds'>;

export type CambiosMovimiento = Partial<Pick<ProyectoFlujo,
  'etapaFlujo' | 'etapaFlujoDesde' | 'etapaEjecucion' | 'etapaEjecucionDesde' |
  'historial' | 'motivoCierre' | 'servicioIds'>>;

/**
 * Cambios a guardar al mover un proyecto. Devuelve null si no hay cambio.
 * Al pasar a `contrato`, si el proyecto tiene un servicio de ejecución y el
 * carril aún no está activo, lo activa en `por_programar`.
 */
export function aplicarMovimiento(
  p: ProyectoMovible,
  carril: Carril,
  destino: EtapaFlujo | EtapaEjecucion,
  ahora: Date,
  opciones: { motivoCierre?: string; servicioIdsEjecucion?: readonly string[] } = {},
): CambiosMovimiento | null {
  if (carril === 'ejecucion') {
    if (p.etapaEjecucion === destino) return null;
    return {
      etapaEjecucion:      destino as EtapaEjecucion,
      etapaEjecucionDesde: ahora,
      historial:           agregarAlHistorial(p.historial, 'ejecucion', destino, ahora),
    };
  }

  if (p.etapaFlujo === destino) return null;
  if (destino === 'no_se_dio' && !opciones.motivoCierre?.trim()) {
    throw new Error('motivoCierre es obligatorio para mover a "no_se_dio"');
  }

  let historial = agregarAlHistorial(p.historial, 'diseno', destino, ahora);
  const cambios: CambiosMovimiento = {
    etapaFlujo:      destino as EtapaFlujo,
    etapaFlujoDesde: ahora,
  };
  if (destino === 'no_se_dio') cambios.motivoCierre = opciones.motivoCierre!.trim();

  const tieneEjecucion = (opciones.servicioIdsEjecucion ?? [])
    .some(id => p.servicioIds.includes(id));
  if (destino === 'contrato' && tieneEjecucion && p.etapaEjecucion == null) {
    cambios.etapaEjecucion      = ETAPA_INICIAL_EJECUCION;
    cambios.etapaEjecucionDesde = ahora;
    historial = agregarAlHistorial(historial, 'ejecucion', ETAPA_INICIAL_EJECUCION, ahora);
  }

  cambios.historial = historial;
  return cambios;
}

/**
 * "Continuar con siguiente fase": agrega el servicio al mismo proyecto y lo
 * devuelve a `diseno`, o activa el carril de ejecución si la fase es de ejecución.
 */
export function aplicarSiguienteFase(
  p: ProyectoMovible,
  servicioId: string,
  servicioNombre: string,
  esEjecucion: boolean,
  ahora: Date,
): CambiosMovimiento {
  const servicioIds = p.servicioIds.includes(servicioId)
    ? [...p.servicioIds]
    : [...p.servicioIds, servicioId];
  const nota = `Siguiente fase: ${servicioNombre}`;

  if (esEjecucion) {
    return {
      servicioIds,
      etapaEjecucion:      ETAPA_INICIAL_EJECUCION,
      etapaEjecucionDesde: ahora,
      historial: agregarAlHistorial(p.historial, 'ejecucion', ETAPA_INICIAL_EJECUCION, ahora, nota),
    };
  }
  return {
    servicioIds,
    etapaFlujo:      ETAPA_SIGUIENTE_FASE_DISENO,
    etapaFlujoDesde: ahora,
    historial: agregarAlHistorial(p.historial, 'diseno', ETAPA_SIGUIENTE_FASE_DISENO, ahora, nota),
  };
}

// ── Avisos al mover (no bloquean, salvo motivoCierre) ────────────────────────

export interface ContextoMovimiento {
  /** El usuario tiene acceso a Contabilidad. */
  esContabilidad: boolean;
  /** Solo se consulta si esContabilidad. */
  anticipoPagado?: boolean;
  /** Solo se consulta si esContabilidad. */
  porCobrar?: number;
}

export interface ResultadoAvisos {
  avisos: string[];
  requiereMotivoCierre: boolean;
  ofrecerPortafolio: boolean;
}

export function avisosAlMover(
  p: Pick<ProyectoFlujo, 'documentos' | 'portafolioProyectoId'>,
  destino: EtapaFlujo,
  ctx: ContextoMovimiento,
): ResultadoAvisos {
  const avisos: string[] = [];
  const tieneDoc = (tipo: string) => p.documentos.some(d => d.tipo === tipo);

  if (destino === 'diseno') {
    const faltaContrato = !tieneDoc('contrato');
    const faltaAnticipo = ctx.esContabilidad && ctx.anticipoPagado === false;
    if (faltaContrato || faltaAnticipo) avisos.push('Falta contrato o anticipo');
  }
  if (destino === 'archivado' && ctx.esContabilidad && (ctx.porCobrar ?? 0) > 0) {
    avisos.push(`Quedan ${formatoCOP(ctx.porCobrar!)} por cobrar`);
  }
  if (destino === 'revision' && !tieneDoc('informe')) {
    avisos.push('Adjunta el enlace del informe enviado');
  }

  return {
    avisos,
    requiereMotivoCierre: destino === 'no_se_dio',
    ofrecerPortafolio:    destino === 'portafolio' && !p.portafolioProyectoId,
  };
}

// ── Código PLA-XXX ───────────────────────────────────────────────────────────

const PALABRAS_VACIAS = new Set(['LA', 'EL', 'LOS', 'LAS', 'DE', 'DEL', 'Y', 'E', 'EN', 'UN', 'UNA']);
const VOCALES = new Set(['A', 'E', 'I', 'O', 'U']);
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const PATRON_CODIGO = /^PLA-[A-Z]{3}$/;

function palabrasDe(nombre: string): string[] {
  const limpio = nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
  if (!limpio) return [];
  const todas = limpio.split(' ');
  const utiles = todas.filter(w => !PALABRAS_VACIAS.has(w));
  return utiles.length ? utiles : todas;
}

/** Tres letras base: iniciales de las palabras y, si faltan, consonantes. */
function letrasBase(palabras: string[]): string {
  if (!palabras.length) return 'PRY';
  let letras = palabras.slice(0, 3).map(w => w[0]).join('');
  const resto = palabras.map(w => w.slice(1)).join('');
  const consonantes = [...resto].filter(c => !VOCALES.has(c));
  const vocales     = [...resto].filter(c => VOCALES.has(c));
  for (const c of [...consonantes, ...vocales]) {
    if (letras.length >= 3) break;
    letras += c;
  }
  return letras.padEnd(3, 'X');
}

/**
 * Sugiere un código único "PLA-XXX" a partir del nombre del proyecto.
 * `usados` contiene códigos completos ("PLA-HRZ").
 */
export function sugerirCodigo(nombre: string, usados: ReadonlySet<string>): string {
  const palabras = palabrasDe(nombre);
  const base = letrasBase(palabras);
  const libre = (l: string) => !usados.has(`PLA-${l}`);

  if (libre(base)) return `PLA-${base}`;

  // Variar la tercera letra con letras del propio nombre, luego con el abecedario
  const delNombre = [...new Set(palabras.join(''))];
  for (const c of [...delNombre, ...ABC]) {
    const cand = base.slice(0, 2) + c;
    if (libre(cand)) return `PLA-${cand}`;
  }
  // Variar segunda y tercera
  for (const a of ABC) for (const b of ABC) {
    const cand = base[0] + a + b;
    if (libre(cand)) return `PLA-${cand}`;
  }
  for (const x of ABC) for (const a of ABC) for (const b of ABC) {
    const cand = x + a + b;
    if (libre(cand)) return `PLA-${cand}`;
  }
  throw new Error('No quedan códigos PLA-XXX libres');
}
