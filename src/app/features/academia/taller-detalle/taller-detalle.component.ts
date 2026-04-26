import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { TallerService } from '../../../services/taller.service';
import { CsvExportService, CsvColumn } from '../../../services/csv-export.service';
import { Taller, Participante } from '../../../shared/models/taller.model';
import { ParticipanteModalComponent } from './participante-modal/participante-modal.component';

@Component({
  selector: 'app-taller-detalle',
  imports: [CurrencyPipe, DatePipe, RouterLink, ParticipanteModalComponent],
  templateUrl: './taller-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TallerDetalleComponent {
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private tallerService = inject(TallerService);
  private csvExport     = inject(CsvExportService);

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

  exportarParticipantesCsv(): void {
    const t = this.taller();
    if (!t) return;
    const columns: CsvColumn<Participante>[] = [
      { header: 'Nombre',          value: p => p.nombreCompleto },
      { header: 'WhatsApp',        value: p => p.whatsapp },
      { header: 'Email',           value: p => p.email },
      { header: 'Ciudad',          value: p => p.ciudadOrigen },
      { header: 'Cómo nos conoció', value: p => p.comoNosConocio },
      { header: 'Pagó',            value: p => p.pago },
      { header: 'Monto',           value: p => p.montoPagado },
      { header: 'Notas',           value: p => p.notas },
      { header: 'Inscripción',     value: p => p.creadoEn },
    ];
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const slug = this.slugify(t.nombre);
    this.csvExport.exportToCsv(`taller_${slug}_participantes_${stamp}.csv`, columns, this.participantesLista());
  }

  private slugify(input: string): string {
    const stripped = input.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return stripped || 'taller';
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
