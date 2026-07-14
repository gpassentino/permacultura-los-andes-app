import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Proyecto, Pago, TIPOS_PAGO, METODOS_PAGO, calcularSubtotal } from '../../../shared/models/proyecto.model';

@Component({
  selector: 'app-pagos-logger',
  imports: [FormsModule, DatePipe],
  templateUrl: './pagos-logger.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagosLoggerComponent {
  readonly proyecto      = input.required<Proyecto>();
  readonly pagoAgregado  = output<Omit<Pago, 'id'>>();
  readonly pagoEliminado = output<string>();

  readonly TIPOS_PAGO   = TIPOS_PAGO;
  readonly METODOS_PAGO = METODOS_PAGO;

  readonly mostrarForm = signal(false);
  readonly nuevo = signal<Omit<Pago, 'id'>>({
    tipo: 'anticipo', monto: 0, fecha: null, metodo: 'Transferencia', notas: ''
  });

  readonly totalFacturado = computed(() => calcularSubtotal(this.proyecto().presupuesto));
  readonly totalCobrado   = computed(() => this.proyecto().pagos.reduce((s, p) => s + p.monto, 0));
  readonly pendiente      = computed(() => this.totalFacturado() - this.totalCobrado());

  readonly anticipoSugerido = computed(() => Math.round(this.totalFacturado() * 0.5));

  parseFecha(value: string): void {
    this.updateNuevo({ fecha: value ? new Date(value) : null });
  }

  abrirForm(): void {
    this.nuevo.set({ tipo: 'anticipo', monto: this.anticipoSugerido(), fecha: new Date(), metodo: 'Transferencia', notas: '' });
    this.mostrarForm.set(true);
  }

  updateNuevo(partial: Partial<Omit<Pago, 'id'>>): void {
    this.nuevo.set({ ...this.nuevo(), ...partial });
  }

  agregar(): void {
    if (!this.nuevo().monto) return;
    this.pagoAgregado.emit(this.nuevo());
    this.mostrarForm.set(false);
  }

  eliminar(id: string): void {
    if (confirm('¿Eliminar este pago?')) this.pagoEliminado.emit(id);
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = { anticipo: 'Anticipo', pago_final: 'Pago final', otro: 'Otro' };
    return map[tipo] ?? tipo;
  }

  formatCOP(n: number): string { return '$' + Math.round(n).toLocaleString('es-CO'); }
}
