import { ProyectoFlujo, TipoDocumento } from '../../shared/models/proyecto-flujo.model';
import { TipoServicio } from '../../shared/models/servicio.model';

export interface ServicioRef {
  id: string;
  nombre: string;
  tipo: TipoServicio;
}

/**
 * Proyecto ya cruzado en memoria con su contacto (de `contacts`, o la copia de
 * `clientes` como respaldo para los migrados) y los nombres de sus servicios.
 */
export interface ProyectoVista extends ProyectoFlujo {
  id: string;
  contactoNombre: string;
  contactoTelefono: string;
  /** true si el nombre viene de la copia en `clientes` y no de `contacts`. */
  contactoDesdeRespaldo: boolean;
  servicios: ServicioRef[];
}

/** Documentos clave que se muestran como icono en la tarjeta. */
export const ICONOS_DOCUMENTO: { tipo: TipoDocumento; icono: string; label: string }[] = [
  { tipo: 'cotizacion',  icono: '🧾', label: 'Cotización' },
  { tipo: 'contrato',    icono: '✍️', label: 'Contrato' },
  { tipo: 'acta_visita', icono: '📋', label: 'Acta de visita' },
  { tipo: 'informe',     icono: '📐', label: 'Informe' },
  { tipo: 'dossier',     icono: '📦', label: 'Dossier' },
  { tipo: 'reel',        icono: '🎬', label: 'Reel' },
];
