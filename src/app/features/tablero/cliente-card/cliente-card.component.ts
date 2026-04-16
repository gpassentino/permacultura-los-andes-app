import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { Cliente } from '../../../shared/models/cliente.model';

@Component({
  selector: 'app-cliente-card',
  imports: [],
  templateUrl: './cliente-card.component.html',
  styleUrl: './cliente-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClienteCardComponent {
  readonly cliente = input.required<Cliente>();

  readonly diasDesdeContacto = computed(() => {
    const fecha = this.cliente().fechaUltimoContacto;
    if (!fecha) return null;
    return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  });

  readonly isRecordatorioVencido = computed(() => {
    const f = this.cliente().recordatorioFecha;
    return !!f && f < new Date();
  });

  readonly isRecordatorioPronto = computed(() => {
    const f = this.cliente().recordatorioFecha;
    if (!f || f < new Date()) return false;
    const tresDias = new Date();
    tresDias.setDate(tresDias.getDate() + 3);
    return f <= tresDias;
  });

  readonly whatsappUrl = computed(() => {
    const num = this.cliente().whatsapp.replace(/\D/g, '');
    return `https://wa.me/57${num}`;
  });

  readonly tipoBadgeClass = computed(() => {
    const map: Record<string, string> = {
      'Paisajismo Regenerativo': 'bg-success',
      'Diseño y Manejo del Agua': 'bg-info text-dark',
      'Bosque Comestible': 'bg-success',
      'Taller Presencial': 'bg-warning text-dark',
      'Consultoría': 'bg-secondary',
      'Otro': 'bg-secondary'
    };
    return map[this.cliente().tipoProyecto] ?? 'bg-secondary';
  });
}
