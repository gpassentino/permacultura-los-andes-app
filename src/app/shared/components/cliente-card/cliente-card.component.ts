import { Component, input, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Cliente } from '../../models/cliente.model';
import { RecordatorioService } from '../../../services/recordatorio.service';

@Component({
  selector: 'app-cliente-card',
  imports: [],
  templateUrl: './cliente-card.component.html',
  styleUrl: './cliente-card.component.scss',
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

  readonly tipoBadgeClass = computed(() => {
    const map: Record<string, string> = {
      'Paisajismo Regenerativo':  'badge-tipo-paisajismo',
      'Diseño y Manejo del Agua': 'badge-tipo-agua',
      'Bosque Comestible':        'badge-tipo-bosque',
      'Taller Presencial':        'badge-tipo-taller',
      'Consultoría':              'badge-tipo-consultoria',
      'Otro':                     'badge-tipo-otro'
    };
    return map[this.cliente().tipoProyecto] ?? 'badge-tipo-otro';
  });

  readonly diasContactoClass = computed(() => {
    const d = this.diasDesdeContacto();
    if (d === null) return 'text-muted';
    if (d > 14) return 'text-danger fw-semibold';
    if (d > 7)  return 'text-warning-emphasis';
    return 'text-muted';
  });
}
