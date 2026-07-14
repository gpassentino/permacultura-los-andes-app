import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Proyecto, calcularResumen, calcularSubtotal } from '../../../shared/models/proyecto.model';

@Component({
  selector: 'app-resumen-financiero',
  imports: [DatePipe],
  templateUrl: './resumen-financiero.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenFinancieroComponent {
  readonly proyecto = input.required<Proyecto>();

  readonly resumen = computed(() => {
    const p = this.proyecto();
    return calcularResumen(p.presupuesto, p.pagos, p.gastos);
  });

  readonly anticipoEsperado = computed(() => Math.round(calcularSubtotal(this.proyecto().presupuesto) * 0.5));
  readonly finalEsperado    = computed(() => Math.round(calcularSubtotal(this.proyecto().presupuesto) * 0.5));
  readonly totalCobrado     = computed(() => this.proyecto().pagos.reduce((s, p) => s + p.monto, 0));
  readonly pendiente        = computed(() => this.resumen().totalFacturado - this.totalCobrado());

  formatCOP(n: number): string { return '$' + Math.round(n).toLocaleString('es-CO'); }
}
