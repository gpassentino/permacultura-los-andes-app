import { Component, input, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cliente, categoriaBadgeClass } from '../../models/cliente.model';
import { RecordatorioService } from '../../../services/recordatorio.service';

@Component({
  selector: 'app-cliente-card',
  imports: [RouterLink],
  templateUrl: './cliente-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClienteCardComponent {
  readonly cliente = input.required<Cliente>();

  private recordatorioService = inject(RecordatorioService);

  readonly diasDesdeContacto = computed(() => {
    const fecha = this.cliente().fechaUltimoContacto;
    if (!fecha) return null;
    return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  });

  readonly estadoRecordatorio = computed(() =>
    this.recordatorioService.getEstado(this.cliente())
  );

  readonly mostrarBadge = computed(() =>
    this.recordatorioService.esBadge(this.cliente())
  );

  readonly badgeClass = computed(() =>
    this.recordatorioService.badgeClass(this.cliente())
  );

  readonly badgeIcon = computed(() =>
    this.recordatorioService.badgeIcon(this.cliente())
  );

  readonly whatsappUrl = computed(() => {
    const num = this.cliente().whatsapp.replace(/\D/g, '');
    return `https://wa.me/57${num}`;
  });

  readonly categoriaBadgeClass = computed(() => categoriaBadgeClass(this.cliente().categoria));

  readonly checklistProgress = computed(() => {
    const items = this.cliente().checklist ?? [];
    return { done: items.filter(i => i.completado).length, total: items.length };
  });

  // Next 2 incomplete items, in checklist order — drives the "Próximo:" preview on the card.
  // Field-utility: husband sees what to do next at a glance without opening the modal.
  readonly nextItems = computed(() => {
    const items = this.cliente().checklist ?? [];
    return items.filter(i => !i.completado).slice(0, 2);
  });

  readonly diasContactoClass = computed(() => {
    const d = this.diasDesdeContacto();
    if (d === null) return 'text-muted';
    if (d > 14) return 'text-danger fw-semibold';
    if (d > 7)  return 'text-warning-emphasis';
    return 'text-muted';
  });
}
