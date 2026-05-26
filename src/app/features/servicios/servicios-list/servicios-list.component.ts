import {
  Component, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { ServicioService } from '../../../services/servicio.service';
import {
  Servicio, TipoServicio,
  TIPOS_SERVICIO_LABELS, RUBROS, RUBROS_LABELS,
  formatPrecio,
} from '../../../shared/models/servicio.model';
import { copyToClipboard } from '../../../shared/utils/clipboard';
import { ServicioFormComponent } from '../servicio-form/servicio-form.component';

type FilterChip = 'todos' | 'asesorias' | 'informe' | 'ruta1' | 'ruta2' | 'inactivos';

@Component({
  selector: 'app-servicios-list',
  imports: [ServicioFormComponent],
  templateUrl: './servicios-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiciosListComponent {
  private servicioService = inject(ServicioService);

  readonly TIPOS_SERVICIO_LABELS = TIPOS_SERVICIO_LABELS;
  readonly RUBROS = RUBROS;
  readonly RUBROS_LABELS = RUBROS_LABELS;
  readonly formatPrecio = formatPrecio;

  private readonly serviciosRaw = toSignal(this.servicioService.getServicios());

  readonly loading   = computed(() => this.serviciosRaw() === undefined);
  readonly servicios = computed(() => this.serviciosRaw() ?? []);

  readonly chip = signal<FilterChip>('todos');

  readonly filtered = computed(() => {
    const list = this.servicios();
    const c = this.chip();
    if (c === 'inactivos') return list.filter(s => !s.activo);
    const activos = list.filter(s => s.activo);
    switch (c) {
      case 'todos':     return activos;
      case 'asesorias': return activos.filter(s => s.tipo === 'asesoria_online' || s.tipo === 'asesoria_in_situ');
      case 'informe':   return activos.filter(s => s.tipo === 'informe_vision');
      case 'ruta1':     return activos.filter(s => s.tipo === 'fase_ruta1');
      case 'ruta2':     return activos.filter(s => s.tipo === 'gran_escala_ruta2');
    }
  });

  // Modal state
  readonly showModal = signal(false);
  readonly selected  = signal<Servicio | null>(null);
  readonly error     = signal<string | null>(null);

  // Toast
  readonly copiedId = signal<string | null>(null);

  openNuevo() {
    this.selected.set(null);
    this.showModal.set(true);
  }

  openEditar(s: Servicio) {
    this.selected.set(s);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selected.set(null);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  async onGuardar(payload: { data: Partial<Servicio>; id?: string }) {
    try {
      if (payload.id) {
        await this.servicioService.updateServicio(payload.id, payload.data);
      } else {
        await this.servicioService.addServicio(payload.data);
      }
      this.closeModal();
    } catch (err) {
      console.error(err);
      this.error.set('No se pudo guardar el servicio.');
    }
  }

  async onEliminar(id: string) {
    if (!confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.')) return;
    try {
      await this.servicioService.deleteServicio(id);
      this.closeModal();
    } catch (err) {
      console.error(err);
      this.error.set('No se pudo eliminar el servicio.');
    }
  }

  async copiar(s: Servicio) {
    const text = this.buildClipboardText(s);
    const ok = await copyToClipboard(text);
    if (ok) {
      this.copiedId.set(s.id ?? null);
      setTimeout(() => this.copiedId.set(null), 2000);
    } else {
      this.error.set('No se pudo copiar. Revisa los permisos del navegador.');
    }
  }

  private buildClipboardText(s: Servicio): string {
    const parts: string[] = [];
    parts.push(`*${s.nombre}*`);
    parts.push('');
    if (s.descripcion) {
      parts.push(s.descripcion);
      parts.push('');
    }
    if (s.queIncluye) {
      parts.push('📋 *¿Qué incluye?*');
      parts.push(s.queIncluye);
      parts.push('');
    }
    parts.push('💰 *Inversión:*');
    parts.push(formatPrecio(s.precio));
    parts.push('');
    parts.push('¿Te interesa? Cuéntame más sobre tu proyecto. 🌱');
    return parts.join('\n');
  }

  // Helpers for badge classes
  badgeClass(tipo: TipoServicio): string {
    switch (tipo) {
      case 'asesoria_online':    return 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'asesoria_in_situ':   return 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'informe_vision':     return 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'fase_ruta1':         return 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
      case 'gran_escala_ruta2':  return 'badge bg-primary-subtle text-primary-emphasis border border-primary-subtle';
    }
  }
}
