import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { TallerService } from '../../../services/taller.service';
import { Taller, Participante } from '../../../shared/models/taller.model';
import { ParticipanteModalComponent } from './participante-modal/participante-modal.component';

@Component({
  selector: 'app-taller-detalle',
  imports: [CurrencyPipe, DatePipe, ParticipanteModalComponent],
  templateUrl: './taller-detalle.component.html',
  styleUrl: './taller-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TallerDetalleComponent {
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private tallerService = inject(TallerService);

  // Resolve the taller id from the route, then stream taller + participantes
  private readonly tallerId$ = this.route.paramMap.pipe(
    switchMap(params => {
      const id = params.get('id')!;
      return [id];
    })
  );

  private readonly tallerId = toSignal(this.tallerId$);

  readonly taller = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.tallerService.getTaller(params.get('id')!))
    )
  );

  readonly participantes = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.tallerService.getParticipantes(params.get('id')!))
    )
  );

  readonly loading            = computed(() => this.taller() === undefined);
  readonly participantesLista = computed(() => this.participantes() ?? []);

  // Participante stats (computed locally — participantesCount on taller is source of truth for totals)
  readonly totalPagaron = computed(() =>
    this.participantesLista().filter(p => p.pago).length
  );
  readonly totalRecaudadoLocal = computed(() =>
    this.participantesLista().reduce((sum, p) => sum + (p.pago ? (p.montoPagado ?? 0) : 0), 0)
  );

  // Modal state
  readonly showModal          = signal(false);
  readonly selectedParticipante = signal<Participante | null>(null);
  readonly error              = signal<string | null>(null);

  openNuevoParticipante(): void {
    this.selectedParticipante.set(null);
    this.showModal.set(true);
  }

  openEditarParticipante(p: Participante): void {
    this.selectedParticipante.set(p);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedParticipante.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModal();
    }
  }

  async onGuardar(event: { data: Partial<Participante>; id?: string }): Promise<void> {
    const id = this.tallerId();
    if (!id) return;
    try {
      this.error.set(null);
      if (event.id) {
        const old = this.selectedParticipante()!;
        await this.tallerService.updateParticipante(id, event.id, old, event.data);
      } else {
        await this.tallerService.addParticipante(id, event.data);
      }
      this.closeModal();
    } catch {
      this.error.set('Error al guardar el participante. Intente de nuevo.');
    }
  }

  async onEliminar(participanteId: string): Promise<void> {
    const id = this.tallerId();
    if (!id) return;
    const p = this.selectedParticipante();
    if (!p) return;
    try {
      this.error.set(null);
      await this.tallerService.deleteParticipante(id, p);
      this.closeModal();
    } catch {
      this.error.set('Error al eliminar el participante. Intente de nuevo.');
    }
  }

  goBack(): void {
    this.router.navigate(['/academia']);
  }

  whatsappUrl(whatsapp: string): string {
    const num = whatsapp.replace(/\D/g, '');
    return `https://wa.me/57${num}`;
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

  cupoLabel(taller: Taller): string {
    if (!taller.cupoMaximo) return `${taller.participantesCount} inscritos`;
    return `${taller.participantesCount} / ${taller.cupoMaximo}`;
  }
}
