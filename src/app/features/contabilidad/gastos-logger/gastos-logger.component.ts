import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Proyecto, Gasto, TIPOS_GASTO } from '../../../shared/models/proyecto.model';

@Component({
  selector: 'app-gastos-logger',
  imports: [FormsModule],
  templateUrl: './gastos-logger.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GastosLoggerComponent {
  readonly proyecto       = input.required<Proyecto>();
  readonly gastoAgregado  = output<Omit<Gasto, 'id'>>();
  readonly gastoEliminado = output<string>();

  readonly TIPOS_GASTO = TIPOS_GASTO;
  readonly mostrarForm = signal(false);
  readonly nuevo = signal<Omit<Gasto, 'id'>>({
    tipo: 'carlos', descripcion: 'Carlos', cantidad: 1, valorUnitario: 200_000, subtotal: 200_000, notas: ''
  });

  readonly tipoLabels: Record<string, string> = {
    sofia: 'Sofía (diseño)',
    carlos: 'Carlos (mano de obra)',
    ayudante: 'Ayudante',
    pastrana: 'Pastrana',
    trabajador_otro: 'Otro trabajador',
    planta: 'Material vegetal',
    insumo: 'Insumo',
    logistica: 'Logística',
    viatico: 'Viático',
    otro: 'Otro',
  };

  readonly defaultsPerTipo: Record<string, Partial<Omit<Gasto, 'id'>>> = {
    sofia:           { descripcion: 'Sofía (diseño)',      cantidad: 1, valorUnitario: 250_000 },
    carlos:          { descripcion: 'Carlos',              cantidad: 1, valorUnitario: 200_000 },
    ayudante:        { descripcion: 'Ayudante',            cantidad: 1, valorUnitario: 130_000 },
    pastrana:        { descripcion: 'Pastrana',            cantidad: 1, valorUnitario: 130_000 },
    trabajador_otro: { descripcion: '',                    cantidad: 1, valorUnitario: 130_000 },
    planta:          { descripcion: 'Material vegetal',    cantidad: 1, valorUnitario: 0 },
    insumo:          { descripcion: 'Insumo',              cantidad: 1, valorUnitario: 0 },
    logistica:       { descripcion: 'Logística',           cantidad: 1, valorUnitario: 0 },
    viatico:         { descripcion: 'Viáticos',            cantidad: 1, valorUnitario: 0 },
    otro:            { descripcion: '',                    cantidad: 1, valorUnitario: 0 },
  };

  onTipoChange(tipo: string): void {
    const defaults = this.defaultsPerTipo[tipo] ?? {};
    const subtotal = (defaults.cantidad ?? 1) * (defaults.valorUnitario ?? 0);
    this.nuevo.set({ ...this.nuevo(), tipo: tipo as any, ...defaults, subtotal });
  }

  updateNuevo(partial: Partial<Omit<Gasto, 'id'>>): void {
    const updated = { ...this.nuevo(), ...partial };
    updated.subtotal = updated.cantidad * updated.valorUnitario;
    this.nuevo.set(updated);
  }

  agregar(): void {
    if (!this.nuevo().subtotal && !this.nuevo().valorUnitario) return;
    this.gastoAgregado.emit(this.nuevo());
    this.mostrarForm.set(false);
  }

  eliminar(id: string): void {
    if (confirm('¿Eliminar este gasto?')) this.gastoEliminado.emit(id);
  }

  get totalGastos(): number {
    return this.proyecto().gastos.reduce((s, g) => s + g.subtotal, 0);
  }

  formatCOP(n: number): string { return '$' + Math.round(n).toLocaleString('es-CO'); }
}
