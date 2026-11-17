// Mapeo puro `clientes` → `proyectosFlujo` (1 a 1, mismo id). Lo usa
// scripts/migrate-proyectos-flujo.ts y se prueba con Vitest.

import {
  Documento,
  EntradaHistorial,
  EstadoVisita,
  EtapaEjecucion,
  EtapaFlujo,
  ProyectoFlujo,
  TipoDocumento,
} from '../models/proyecto-flujo.model';
import { sugerirCodigo } from './flujo';

/** Registro de `clientes` tal como se lee de Firestore, con fechas ya convertidas. */
export interface ClienteLegacy {
  id: string;
  contactoId?: string;
  nombre?: string;
  categoria?: string;
  estado?: string;
  municipio?: string;
  notas?: string;
  documentos?: { label?: string; url?: string }[];
  checklist?: { texto?: string; fase?: string; completado?: boolean }[];
  recordatorioFecha?: Date | null;
  recordatorioMensaje?: string;
  fechaUltimoContacto?: Date | null;
  fechaEstimadaInicio?: Date | null;
  creadoEn?: Date | null;
  creadoPor?: string;
  actualizadoEn?: Date | null;
}

export interface ContextoMigracion {
  /** Id del servicio por tipo (ver planServicios). */
  servicioIdPorTipo: Record<string, string>;
  /** Códigos ya usados; se agrega el sugerido. */
  codigosUsados: Set<string>;
  proyectoFinancieroId?: string;
  ahora: Date;
}

export type FuenteFecha = 'fechaEstimadaInicio' | 'actualizadoEn' | 'migracion';

export interface ResultadoMigracion {
  id: string;
  proyecto: Omit<ProyectoFlujo, 'id'>;
  /** Información solo para el reporte del dry-run. */
  detalle: {
    estadoAnterior: string;
    categoriaAnterior: string;
    fuenteEtapaDesde: FuenteFecha;
  };
}

// ── Tablas de mapeo ──────────────────────────────────────────────────────────

/** Categoría anterior → tipo de servicio del catálogo. */
export const CATEGORIA_A_TIPO_SERVICIO: Record<string, string> = {
  'Visita Técnica':    'asesoria_in_situ',
  'Diseño Conceptual': 'informe_vision',
  'Diseño Técnico':    'diseno_tecnico',
  'Implementación':    'ejecucion',
};

export function mapearEtapas(
  estado: string | undefined,
  categoria: string | undefined,
): { etapaFlujo: EtapaFlujo; etapaEjecucion: EtapaEjecucion | null; revisarEtapa: boolean } {
  const impl = categoria === 'Implementación';
  const sinCategoria = !categoria || !(categoria in CATEGORIA_A_TIPO_SERVICIO);
  switch (estado) {
    case 'Antes':
      // Implementación aún no contratada: el carril se activa al pasar a contrato
      return { etapaFlujo: 'propuesta', etapaEjecucion: null, revisarEtapa: false };
    case 'Durante':
      return impl
        ? { etapaFlujo: 'entregado', etapaEjecucion: 'en_obra', revisarEtapa: false }
        : { etapaFlujo: 'diseno', etapaEjecucion: null, revisarEtapa: sinCategoria };
    case 'Después':
      return { etapaFlujo: 'entregado', etapaEjecucion: impl ? 'mantenimiento' : null, revisarEtapa: false };
    case 'Completo':
      return { etapaFlujo: 'portafolio', etapaEjecucion: impl ? 'ejecucion_cerrada' : null, revisarEtapa: false };
    case 'Archivado':
      return { etapaFlujo: 'archivado', etapaEjecucion: impl ? 'ejecucion_cerrada' : null, revisarEtapa: false };
    default:
      return { etapaFlujo: 'propuesta', etapaEjecucion: null, revisarEtapa: true };
  }
}

// ── Documentos ───────────────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Infiere el tipo por el nombre o la URL; `otro` solo si no se puede. */
export function inferirTipoDocumento(label = '', url = ''): TipoDocumento {
  const t = normalizar(`${label} ${url}`);
  if (/otro\s?si/.test(t))                                 return 'otrosi';
  if (/contrato/.test(t))                                  return 'contrato';
  if (/cotiza|presupuesto|propuesta/.test(t))              return 'cotizacion';
  if (/\bacta\b/.test(t))                                  return 'acta_visita';
  if (/informe/.test(t))                                   return 'informe';
  if (/dossier/.test(t))                                   return 'dossier';
  if (/\breel\b|instagram\.com\/reels?\//.test(t))         return 'reel';
  if (/visita/.test(t))                                    return 'acta_visita';
  return 'otro';
}

const ETAPA_POR_TIPO: Partial<Record<TipoDocumento, EtapaFlujo>> = {
  cotizacion:  'propuesta',
  contrato:    'contrato',
  otrosi:      'contrato',
  acta_visita: 'diseno',
  informe:     'revision',
  dossier:     'entregado',
  reel:        'portafolio',
};

export function inferirVersion(label = ''): string | undefined {
  const m = /\bv\s?(\d+)\b/i.exec(label);
  return m ? `v${m[1]}` : undefined;
}

export function mapearDocumentos(
  docs: ClienteLegacy['documentos'],
  etapaActual: EtapaFlujo,
  fecha: Date,
): Documento[] {
  return (docs ?? [])
    .filter(d => (d.url ?? '').trim())
    .map((d, i) => {
      const label = (d.label ?? '').trim();
      const tipo = inferirTipoDocumento(label, d.url);
      const doc: Documento = {
        id:    `mig-${i + 1}`,
        tipo,
        etapa: ETAPA_POR_TIPO[tipo] ?? etapaActual,
        url:   d.url!.trim(),
        fecha,
      };
      const version = inferirVersion(label);
      if (version) doc.version = version;
      if (label) doc.nota = label;
      return doc;
    });
}

// ── Visita técnica ───────────────────────────────────────────────────────────

function mapearVisita(c: ClienteLegacy, etapaFlujo: EtapaFlujo): EstadoVisita {
  if (c.categoria !== 'Visita Técnica') return 'no_aplica';
  const hechoEnCampo = (c.checklist ?? []).some(
    i => i.completado && (i.fase === 'durante' || i.fase === 'después'),
  );
  if (hechoEnCampo) return 'hecha';
  return etapaFlujo === 'propuesta' || etapaFlujo === 'diseno' ? 'pendiente' : 'hecha';
}

// ── Fecha de inicio de la etapa ──────────────────────────────────────────────

export function elegirEtapaDesde(c: ClienteLegacy, ahora: Date): { fecha: Date; fuente: FuenteFecha } {
  // "Durante" con fecha estimada de inicio ya cumplida: es cuando empezó la etapa
  if (c.estado === 'Durante' && c.fechaEstimadaInicio && c.fechaEstimadaInicio <= ahora) {
    return { fecha: c.fechaEstimadaInicio, fuente: 'fechaEstimadaInicio' };
  }
  if (c.actualizadoEn && c.actualizadoEn <= ahora) {
    return { fecha: c.actualizadoEn, fuente: 'actualizadoEn' };
  }
  return { fecha: ahora, fuente: 'migracion' };
}

// ── Mapeo principal ──────────────────────────────────────────────────────────

export function mapearCliente(c: ClienteLegacy, ctx: ContextoMigracion): ResultadoMigracion {
  const revisar: string[] = [];
  const { etapaFlujo, etapaEjecucion, revisarEtapa } = mapearEtapas(c.estado, c.categoria);
  if (revisarEtapa) revisar.push('etapa');

  const tipoServicio = c.categoria ? CATEGORIA_A_TIPO_SERVICIO[c.categoria] : undefined;
  const servicioIds: string[] = [];
  if (tipoServicio) {
    const id = ctx.servicioIdPorTipo[tipoServicio];
    if (id) servicioIds.push(id);
    else revisar.push('servicios');
  } else {
    revisar.push('servicios');
  }

  // No existe un campo de nombre de proyecto en `clientes`: se usa el del cliente
  const nombreProyecto = (c.nombre ?? '').trim() || '(sin nombre)';
  revisar.push('nombre');

  const codigo = sugerirCodigo(nombreProyecto, ctx.codigosUsados);
  ctx.codigosUsados.add(codigo);
  revisar.push('codigo');

  if (!c.contactoId) revisar.push('contacto');

  const { fecha: desde, fuente } = elegirEtapaDesde(c, ctx.ahora);
  const notaHist = `Migrado desde clientes (${c.estado ?? '?'} · ${c.categoria ?? '?'})`;
  const historial: EntradaHistorial[] = [{ etapa: etapaFlujo, carril: 'diseno', desde, nota: notaHist }];

  const proyecto: Omit<ProyectoFlujo, 'id'> = {
    contactoId:      c.contactoId ?? '',
    clienteIdLegacy: c.id,
    codigo,
    nombreProyecto,
    etapaFlujo,
    etapaFlujoDesde: desde,
    etapaEjecucion,
    servicioIds,
    visitaTecnica:   mapearVisita(c, etapaFlujo),
    documentos:      mapearDocumentos(c.documentos, etapaFlujo, c.actualizadoEn ?? c.creadoEn ?? ctx.ahora),
    historial,
    revisar,
    creadoEn:        c.creadoEn ?? ctx.ahora,
    creadoPor:       c.creadoPor ?? '',
    actualizadoEn:   ctx.ahora,
    migradoEn:       ctx.ahora,
  };

  if (etapaEjecucion) {
    proyecto.etapaEjecucionDesde = desde;
    historial.push({ etapa: etapaEjecucion, carril: 'ejecucion', desde, nota: notaHist });
  }
  if (ctx.proyectoFinancieroId) proyecto.proyectoFinancieroId = ctx.proyectoFinancieroId;
  if (c.municipio?.trim()) proyecto.municipio = c.municipio.trim();
  if (c.notas?.trim()) proyecto.notas = c.notas.trim();

  const texto = (c.recordatorioMensaje ?? '').trim();
  if (texto || c.recordatorioFecha) {
    proyecto.proximoPaso = { texto: texto || 'Seguimiento' };
    if (c.recordatorioFecha) proyecto.proximoPaso.fecha = c.recordatorioFecha;
  }

  return {
    id: c.id,
    proyecto,
    detalle: {
      estadoAnterior:    c.estado ?? '',
      categoriaAnterior: c.categoria ?? '',
      fuenteEtapaDesde:  fuente,
    },
  };
}
