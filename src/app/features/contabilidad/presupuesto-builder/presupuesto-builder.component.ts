import {
  Component, input, output, signal, computed, OnChanges, ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Proyecto,
  PresupuestoInterno,
  MunicipioViatico,
  LineaPlanta,
  LineaPresupuesto,
  ViaticosData,
  TAMANIOS_BOLSA,
  TARIFA_CARLOS_DIA,
  TARIFA_AYUDANTE_DIA,
  TARIFA_PASTRANA_DIA,
  calcularSubtotal,
} from '../../../shared/models/proyecto.model';

type Vista = 'interna' | 'cliente';

@Component({
  selector: 'app-presupuesto-builder',
  imports: [FormsModule],
  templateUrl: './presupuesto-builder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresupuestoBuilderComponent implements OnChanges {
  readonly proyecto   = input.required<Proyecto>();
  readonly municipios = input<MunicipioViatico[]>([]);
  readonly guardado   = output<PresupuestoInterno>();
  readonly reseteado  = output<void>();

  private lastProyectoId: string | undefined;

  readonly TAMANIOS_BOLSA    = TAMANIOS_BOLSA;
  readonly TARIFA_CARLOS_DIA = TARIFA_CARLOS_DIA;
  readonly TARIFA_AYUDANTE   = TARIFA_AYUDANTE_DIA;
  readonly TARIFA_PASTRANA   = TARIFA_PASTRANA_DIA;

  readonly vista = signal<Vista>('interna');

  // Working copy of the presupuesto (editable signals) — initialized in ngOnChanges
  readonly p = signal<PresupuestoInterno>({
    tarifaBase: 0, tarifaAjustada: 0, disenioSitio: 0, direccionObra: 0,
    diasCarlos: 0, numAyudantes: 0, diasAyudantes: 0, diasPastrana: 0,
    trabajadoresOtros: [], plantas: [],
    bocashiBultos: 0, bocashiPrecioUnitario: 30_000, fertilizantesTotal: 0,
    microorganismosKg: 0, microorganismosPrecioUnitario: 10_000,
    insumosOtros: [], logistica: [], viaticos: null,
    sofiaFee: 0, estebanAplica: false, estebanPorcentaje: 10, notas: '',
  });

  // True for design cards; false for implementation
  readonly esDiseno = computed(() => {
    const cat = this.proyecto().categoria;
    return cat === 'Visita Técnica' || cat === 'Diseño Conceptual' || cat === 'Diseño Técnico';
  });

  readonly totalInterno = computed(() => calcularSubtotal(this.p()));

  readonly comisionEsteban = computed(() => {
    const pr = this.p();
    if (!pr.estebanAplica) return 0;
    const utilidadBruta = calcularSubtotal(pr) - pr.sofiaFee;
    return Math.round(utilidadBruta * pr.estebanPorcentaje / 100);
  });

  readonly totalCliente = computed(() => {
    const pr = this.p();
    if (this.esDiseno()) return pr.tarifaAjustada + (pr.viaticos?.total ?? 0);
    // Implementation: show totals by group
    const manoObra =
      pr.diasCarlos * TARIFA_CARLOS_DIA +
      pr.numAyudantes * pr.diasAyudantes * TARIFA_AYUDANTE_DIA +
      pr.diasPastrana * TARIFA_PASTRANA_DIA +
      pr.trabajadoresOtros.reduce((s, l) => s + l.subtotal, 0);
    const plantas   = pr.plantas.reduce((s, l) => s + l.subtotal, 0);
    const insumos   = pr.bocashiBultos * pr.bocashiPrecioUnitario +
                      pr.fertilizantesTotal +
                      pr.microorganismosKg * pr.microorganismosPrecioUnitario +
                      pr.insumosOtros.reduce((s, l) => s + l.subtotal, 0);
    const logistica = pr.logistica.reduce((s, l) => s + l.subtotal, 0);
    const viaticos  = pr.viaticos?.total ?? 0;
    return (pr.disenioSitio + pr.direccionObra) + manoObra + plantas + insumos + logistica + viaticos;
  });

  ngOnChanges(): void {
    const id = this.proyecto().id;
    if (id !== this.lastProyectoId) {
      this.lastProyectoId = id;
      this.p.set({ ...this.proyecto().presupuesto });
    }
  }

  // ── Viáticos picker ────────────────────────────────────────
  private roundUp5000(n: number): number {
    return Math.ceil(n / 5000) * 5000;
  }

  onMunicipioChange(nombre: string): void {
    if (!nombre) { this.update({ viaticos: null }); return; }
    const m = this.municipios().find(x => x.nombre === nombre);
    if (!m) return;
    const v: ViaticosData = {
      municipio: m.nombre,
      kmIdaVuelta: m.kmIdaVuelta,
      numPeajes: m.numPeajesIdaVuelta,
      costoPeajeTotal: m.costoPeajesTotalRT,
      gastoGasolina: this.roundUp5000(m.gastoGasolina),
      total: this.roundUp5000(m.total),
      editadoManualmente: false,
    };
    this.update({ viaticos: v });
  }

  recalcularViaticos(): void {
    const v = this.p().viaticos;
    if (!v) return;
    const gastoGasolina = this.roundUp5000(v.kmIdaVuelta * 1200);
    const total = this.roundUp5000(gastoGasolina + v.costoPeajeTotal);
    this.update({ viaticos: { ...v, gastoGasolina, total, editadoManualmente: true } });
  }

  // ── Plants ──────────────────────────────────────────────────
  agregarPlanta(): void {
    const nueva: LineaPlanta = {
      id: crypto.randomUUID(),
      nombreArbol: '', nombrePlanta: '', cantidad: 1,
      tamanioBolsa: 'P', precioUnitario: 0, subtotal: 0
    };
    this.update({ plantas: [...this.p().plantas, nueva] });
  }

  actualizarPlanta(id: string, campo: keyof LineaPlanta, valor: any): void {
    const plantas = this.p().plantas.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [campo]: valor };
      updated.subtotal = updated.cantidad * updated.precioUnitario;
      return updated;
    });
    this.update({ plantas });
  }

  eliminarPlanta(id: string): void {
    this.update({ plantas: this.p().plantas.filter(l => l.id !== id) });
  }

  // ── Generic line items (trabajadoresOtros, insumosOtros, logistica) ─
  agregarLinea(campo: 'trabajadoresOtros' | 'insumosOtros' | 'logistica'): void {
    const nueva: LineaPresupuesto = {
      id: crypto.randomUUID(), descripcion: '', cantidad: 1, valorUnitario: 0, subtotal: 0
    };
    this.update({ [campo]: [...(this.p() as any)[campo], nueva] });
  }

  actualizarLinea(
    campo: 'trabajadoresOtros' | 'insumosOtros' | 'logistica',
    id: string, key: keyof LineaPresupuesto, valor: any
  ): void {
    const lineas = ((this.p() as any)[campo] as LineaPresupuesto[]).map((l: LineaPresupuesto) => {
      if (l.id !== id) return l;
      const updated = { ...l, [key]: valor };
      updated.subtotal = updated.cantidad * updated.valorUnitario;
      return updated;
    });
    this.update({ [campo]: lineas });
  }

  eliminarLinea(campo: 'trabajadoresOtros' | 'insumosOtros' | 'logistica', id: string): void {
    this.update({ [campo]: ((this.p() as any)[campo] as LineaPresupuesto[]).filter((l: LineaPresupuesto) => l.id !== id) });
  }

  // ── Generic field update ─────────────────────────────────────
  update(partial: Partial<PresupuestoInterno>, autoguardar = false): void {
    this.p.set({ ...this.p(), ...partial });
    if (autoguardar) this.guardarDebounced();
  }

  guardar(): void {
    this.guardado.emit(this.p());
  }

  private debounceTimer: any;
  guardarDebounced(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.guardado.emit(this.p()), 600);
  }

  formatCOP(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }

  // totals helpers for client view
  get totalManoObra(): number {
    const pr = this.p();
    return pr.diasCarlos * TARIFA_CARLOS_DIA +
           pr.numAyudantes * pr.diasAyudantes * TARIFA_AYUDANTE_DIA +
           pr.diasPastrana * TARIFA_PASTRANA_DIA +
           pr.trabajadoresOtros.reduce((s, l) => s + l.subtotal, 0);
  }
  get totalPlantas(): number { return this.p().plantas.reduce((s, l) => s + l.subtotal, 0); }
  get totalInsumos(): number {
    const pr = this.p();
    return pr.bocashiBultos * pr.bocashiPrecioUnitario +
           pr.fertilizantesTotal +
           pr.microorganismosKg * pr.microorganismosPrecioUnitario +
           pr.insumosOtros.reduce((s, l) => s + l.subtotal, 0);
  }
  get totalLogistica(): number { return this.p().logistica.reduce((s, l) => s + l.subtotal, 0); }
}
