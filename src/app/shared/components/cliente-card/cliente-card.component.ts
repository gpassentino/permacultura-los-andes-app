import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Cliente, categoriaBadgeClass } from '../../models/cliente.model';
import { RecordatorioService } from '../../../services/recordatorio.service';
import {
  Carril, ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS,
} from '../../models/proyecto-flujo.model';
import { diasEnEtapa, estaEstancado, proximoPasoVencido } from '../../logic/flujo';
import { ICONOS_DOCUMENTO, ProyectoVista } from '../../../features/tablero/proyecto-vista';

/**
 * Tarjeta del tablero. Dos modos:
 *  - `proyecto` (flujo de proyectos, actual)
 *  - `cliente`  (registro anterior de `clientes`; se conserva mientras exista)
 */
@Component({
  selector: 'app-cliente-card',
  imports: [RouterLink, DatePipe],
  templateUrl: './cliente-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClienteCardComponent {
  readonly cliente  = input<Cliente | null>(null);
  readonly proyecto = input<ProyectoVista | null>(null);
  /** Carril en el que se pinta la tarjeta (modo proyecto). */
  readonly carril   = input<Carril>('diseno');
  /** Pulsó "Mover a…" (modo proyecto). */
  readonly mover    = output<void>();

  private recordatorioService = inject(RecordatorioService);

  // ── Modo proyecto ──────────────────────────────────────────────────────────

  private readonly ahora = new Date();

  readonly diasEtapa = computed(() => {
    const p = this.proyecto();
    return p ? diasEnEtapa(p, this.ahora, this.carril()) : null;
  });

  readonly etapaLabel = computed(() => {
    const p = this.proyecto();
    if (!p) return '';
    return this.carril() === 'ejecucion' && p.etapaEjecucion
      ? ETAPAS_EJECUCION_LABELS[p.etapaEjecucion]
      : ETAPAS_FLUJO_LABELS[p.etapaFlujo];
  });

  /** Indicador que enlaza los dos carriles cuando el proyecto está en ambos. */
  readonly otroCarril = computed(() => {
    const p = this.proyecto();
    if (!p?.etapaEjecucion) return null;
    return this.carril() === 'diseno'
      ? `Obra: ${ETAPAS_EJECUCION_LABELS[p.etapaEjecucion]}`
      : `Diseño: ${ETAPAS_FLUJO_LABELS[p.etapaFlujo]}`;
  });

  readonly estancado = computed(() => {
    const p = this.proyecto();
    return !!p && this.carril() === 'diseno' && estaEstancado(p, this.ahora);
  });

  readonly pasoVencido = computed(() => {
    const p = this.proyecto();
    return !!p && proximoPasoVencido(p, this.ahora);
  });

  readonly iconosDocumento = computed(() => {
    const p = this.proyecto();
    if (!p) return [];
    const tipos = new Set(p.documentos.map(d => d.tipo));
    return ICONOS_DOCUMENTO.filter(i => tipos.has(i.tipo));
  });

  readonly porRevisar = computed(() => (this.proyecto()?.revisar ?? []).length > 0);

  // ── Modo cliente (registro anterior) ───────────────────────────────────────

  readonly diasDesdeContacto = computed(() => {
    const fecha = this.cliente()?.fechaUltimoContacto;
    if (!fecha) return null;
    return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  });

  readonly estadoRecordatorio = computed(() => {
    const c = this.cliente();
    return c ? this.recordatorioService.getEstado(c) : null;
  });

  readonly mostrarBadge = computed(() => {
    const c = this.cliente();
    return !!c && this.recordatorioService.esBadge(c);
  });

  readonly badgeClass = computed(() => {
    const c = this.cliente();
    return c ? this.recordatorioService.badgeClass(c) : '';
  });

  readonly badgeIcon = computed(() => {
    const c = this.cliente();
    return c ? this.recordatorioService.badgeIcon(c) : '';
  });

  readonly whatsappUrl = computed(() => {
    const num = (this.cliente()?.whatsapp ?? '').replace(/\D/g, '');
    return `https://wa.me/57${num}`;
  });

  readonly categoriaBadgeClass = computed(() => {
    const c = this.cliente();
    return c ? categoriaBadgeClass(c.categoria) : '';
  });

  readonly checklistProgress = computed(() => {
    const items = this.cliente()?.checklist ?? [];
    return { done: items.filter(i => i.completado).length, total: items.length };
  });

  // Next 2 incomplete items, in checklist order — drives the "Próximo:" preview on the card.
  readonly nextItems = computed(() => {
    const items = this.cliente()?.checklist ?? [];
    return items.filter(i => !i.completado).slice(0, 2);
  });

  readonly diasContactoClass = computed(() => {
    const d = this.diasDesdeContacto();
    if (d === null) return 'text-muted';
    if (d > 14) return 'text-danger fw-semibold';
    if (d > 7)  return 'text-warning-emphasis';
    return 'text-muted';
  });

  onMover(event: Event): void {
    event.stopPropagation();
    this.mover.emit();
  }
}
