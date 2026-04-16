import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TallerService } from '../../services/taller.service';
import { Taller, ESTADOS_TALLER } from '../../shared/models/taller.model';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { TallerModalComponent } from './taller-modal/taller-modal.component';

@Component({
  selector: 'app-academia',
  imports: [CurrencyPipe, DatePipe, StatCardComponent, TallerModalComponent],
  templateUrl: './academia.component.html',
  styleUrl: './academia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcademiaComponent {
  private tallerService = inject(TallerService);
  private router        = inject(Router);

  readonly ESTADOS_TALLER = ESTADOS_TALLER;

  private readonly talleresRaw = toSignal(this.tallerService.getTalleres());

  readonly loading  = computed(() => this.talleresRaw() === undefined);
  readonly talleres = computed(() => this.talleresRaw() ?? []);

  // Stats computed from denormalized fields — one pass, no extra queries
  readonly totalTalleres    = computed(() => this.talleres().length);
  readonly totalParticipantes = computed(() =>
    this.talleres().reduce((sum, t) => sum + t.participantesCount, 0)
  );
  readonly totalRecaudado   = computed(() =>
    this.talleres().reduce((sum, t) => sum + t.totalRecaudado, 0)
  );
  readonly talleresFinalizados = computed(() =>
    this.talleres().filter(t => t.estado === 'Finalizado').length
  );

  // Modal state
  readonly showModal       = signal(false);
  readonly selectedTaller  = signal<Taller | null>(null);
  readonly error           = signal<string | null>(null);

  openNuevoTaller(): void {
    this.selectedTaller.set(null);
    this.showModal.set(true);
  }

  openEditarTaller(taller: Taller, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedTaller.set(taller);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedTaller.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModal();
    }
  }

  goToDetalle(taller: Taller): void {
    this.router.navigate(['/academia', taller.id]);
  }

  async onGuardar(event: { data: Partial<Taller>; id?: string }): Promise<void> {
    try {
      this.error.set(null);
      if (event.id) {
        await this.tallerService.updateTaller(event.id, event.data);
      } else {
        await this.tallerService.addTaller(event.data);
      }
      this.closeModal();
    } catch {
      this.error.set('Error al guardar el taller. Intente de nuevo.');
    }
  }

  async onEliminar(id: string): Promise<void> {
    try {
      this.error.set(null);
      await this.tallerService.deleteTaller(id);
      this.closeModal();
    } catch {
      this.error.set('Error al eliminar el taller. Intente de nuevo.');
    }
  }

  ubicacionLabel(taller: Taller): string {
    return [taller.ubicacion, taller.municipio].filter(Boolean).join(', ');
  }

  estadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'Próximo':    'badge-proximo',
      'En Curso':   'badge-en-curso',
      'Finalizado': 'badge-finalizado',
      'Cancelado':  'badge-cancelado'
    };
    return map[estado] ?? 'bg-secondary';
  }
}
