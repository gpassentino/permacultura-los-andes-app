import {
  Component, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { PortafolioService } from '../../../services/portafolio.service';
import {
  ProyectoPortafolio, TipoProyectoPortafolio,
  TIPOS_PROYECTO_PORTAFOLIO_LABELS,
} from '../../../shared/models/portafolio.model';
import { copyToClipboard } from '../../../shared/utils/clipboard';
import { PortafolioFormComponent } from '../portafolio-form/portafolio-form.component';

type FilterChip = 'todos' | 'destacados' | TipoProyectoPortafolio;

@Component({
  selector: 'app-portafolio-list',
  imports: [PortafolioFormComponent],
  templateUrl: './portafolio-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortafolioListComponent {
  private portafolioService = inject(PortafolioService);

  readonly TIPOS_PROYECTO_PORTAFOLIO_LABELS = TIPOS_PROYECTO_PORTAFOLIO_LABELS;

  private readonly proyectosRaw = toSignal(this.portafolioService.getProyectos());

  readonly loading   = computed(() => this.proyectosRaw() === undefined);
  readonly proyectos = computed(() => this.proyectosRaw() ?? []);

  readonly chip = signal<FilterChip>('todos');

  readonly filtered = computed(() => {
    const list = this.proyectos().filter(p => p.activo);
    const c = this.chip();
    if (c === 'todos')      return list;
    if (c === 'destacados') return list.filter(p => p.destacado);
    return list.filter(p => p.tipoProyecto === c);
  });

  // Modal
  readonly showModal = signal(false);
  readonly selected  = signal<ProyectoPortafolio | null>(null);
  readonly error     = signal<string | null>(null);

  // Multi-select
  readonly multiSelectMode = signal(false);
  readonly selectedIds     = signal<Set<string>>(new Set());

  readonly copiedToast = signal(false);

  toggleMultiSelect() {
    const next = !this.multiSelectMode();
    this.multiSelectMode.set(next);
    if (!next) this.selectedIds.set(new Set());
  }

  toggleSelected(id: string) {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  openNuevo() {
    if (this.multiSelectMode()) return;
    this.selected.set(null);
    this.showModal.set(true);
  }

  openEditar(p: ProyectoPortafolio) {
    if (this.multiSelectMode()) return;
    this.selected.set(p);
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

  async onGuardar(payload: { id: string; data: Partial<ProyectoPortafolio>; isNew: boolean }) {
    try {
      await this.portafolioService.saveProyecto(payload.id, payload.data, payload.isNew);
      this.closeModal();
    } catch (err) {
      console.error(err);
      this.error.set('No se pudo guardar el proyecto.');
    }
  }

  async onEliminar(p: ProyectoPortafolio) {
    if (!confirm('¿Eliminar este proyecto del portafolio? Las fotos también se borrarán.')) return;
    try {
      await this.portafolioService.deleteProyecto(p);
      this.closeModal();
    } catch (err) {
      console.error(err);
      this.error.set('No se pudo eliminar el proyecto.');
    }
  }

  fotoPortada(p: ProyectoPortafolio): string | null {
    if (p.fotos.length === 0) return null;
    const idx = Math.min(Math.max(p.fotoPortadaIndex, 0), p.fotos.length - 1);
    return p.fotos[idx]?.url ?? null;
  }

  async copiarSeleccion() {
    const ids = this.selectedIds();
    const list = this.proyectos().filter(p => p.id && ids.has(p.id));
    if (list.length === 0) return;

    const text = this.buildClipboardText(list);
    const ok = await copyToClipboard(text);
    if (ok) {
      this.copiedToast.set(true);
      setTimeout(() => this.copiedToast.set(false), 2000);
    } else {
      this.error.set('No se pudo copiar. Revisa los permisos del navegador.');
    }
  }

  async copiarUno(p: ProyectoPortafolio) {
    const text = this.buildClipboardText([p]);
    const ok = await copyToClipboard(text);
    if (ok) {
      this.copiedToast.set(true);
      setTimeout(() => this.copiedToast.set(false), 2000);
    } else {
      this.error.set('No se pudo copiar. Revisa los permisos del navegador.');
    }
  }

  private buildClipboardText(list: ProyectoPortafolio[]): string {
    const parts: string[] = [];
    parts.push('*Algunos proyectos de Permacultura Los Andes:*');
    parts.push('');
    for (const p of list) {
      parts.push(`🌿 *${p.nombre}* (${p.anio}, ${p.ubicacion})`);
      if (p.descripcion) parts.push(p.descripcion);
      if (p.fotos.length > 0) {
        parts.push('');
        parts.push('Fotos:');
        for (const f of p.fotos) parts.push(`- ${f.url}`);
      }
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    return parts.join('\n');
  }
}
