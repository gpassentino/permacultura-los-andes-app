import {
  Component, inject, signal, computed, ChangeDetectionStrategy, OnInit
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ContabilidadService } from '../../services/contabilidad.service';
import { Proyecto, Pago, Gasto } from '../../shared/models/proyecto.model';
import { PresupuestoBuilderComponent } from './presupuesto-builder/presupuesto-builder.component';
import { PagosLoggerComponent } from './pagos-logger/pagos-logger.component';
import { GastosLoggerComponent } from './gastos-logger/gastos-logger.component';
import { ResumenFinancieroComponent } from './resumen-financiero/resumen-financiero.component';

type MainTab = 'resumen' | 'proyecto';
type ProyectoTab = 'presupuesto' | 'pagos' | 'gastos' | 'resumen_financiero';

@Component({
  selector: 'app-contabilidad',
  imports: [
    PresupuestoBuilderComponent,
    PagosLoggerComponent,
    GastosLoggerComponent,
    ResumenFinancieroComponent,
  ],
  templateUrl: './contabilidad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContabilidadComponent implements OnInit {
  private contabilidadService = inject(ContabilidadService);
  private route               = inject(ActivatedRoute);

  readonly proyectos  = toSignal(this.contabilidadService.getProyectos(), { initialValue: [] });
  readonly municipios = toSignal(this.contabilidadService.getMunicipios(), { initialValue: [] });

  readonly mainTab         = signal<MainTab>('resumen');
  readonly proyectoTab     = signal<ProyectoTab>('presupuesto');
  readonly proyectoActivo  = signal<Proyecto | null>(null);
  readonly guardando       = signal(false);
  readonly error           = signal<string | null>(null);

  // ── Stats for resumen general ────────────────────────────────
  readonly stats = computed(() => {
    const list = this.proyectos();
    const totalFacturado  = list.reduce((s, p) => s + (p.resumen?.totalFacturado  ?? 0), 0);
    const totalCobrado    = list.reduce((s, p) => s + (p.resumen?.totalCobrado    ?? 0), 0);
    const totalGastos     = list.reduce((s, p) => s + (p.resumen?.totalGastos     ?? 0), 0);
    const utilidadTotal   = list.reduce((s, p) => s + (p.resumen?.utilidadAndres  ?? 0), 0);
    return { totalFacturado, totalCobrado, totalGastos, utilidadTotal };
  });

  ngOnInit(): void {
    this.contabilidadService.seedMunicipiosIfEmpty();
    // Auto-open project if arriving from a Kanban card link
    const clienteId = this.route.snapshot.queryParamMap.get('clienteId');
    if (clienteId) {
      // Wait for proyectos to load then open the matching one
      const sub = this.contabilidadService.getProyectos().subscribe(list => {
        const match = list.find(p => p.clienteId === clienteId);
        if (match) { this.abrirProyecto(match); sub.unsubscribe(); }
      });
    }
  }

  abrirProyecto(p: Proyecto): void {
    this.proyectoActivo.set(p);
    this.proyectoTab.set('presupuesto');
    this.mainTab.set('proyecto');
  }

  volverAResumen(): void {
    this.mainTab.set('resumen');
    this.proyectoActivo.set(null);
  }

  async onPresupuestoGuardado(presupuesto: any): Promise<void> {
    const p = this.proyectoActivo();
    if (!p?.id) return;
    this.guardando.set(true);
    try {
      await this.contabilidadService.actualizarPresupuesto(p.id, presupuesto, p.pagos, p.gastos);
      this.error.set(null);
    } catch (e: any) {
      this.error.set('Error al guardar el presupuesto.');
    } finally {
      this.guardando.set(false);
    }
  }

  async onPagoAgregado(pago: Omit<Pago, 'id'>): Promise<void> {
    const p = this.proyectoActivo();
    if (!p?.id) return;
    this.guardando.set(true);
    try {
      await this.contabilidadService.agregarPago(p.id, p, pago);
      this.error.set(null);
    } catch (e: any) {
      this.error.set('Error al guardar el pago.');
    } finally {
      this.guardando.set(false);
    }
  }

  async onPagoEliminado(pagoId: string): Promise<void> {
    const p = this.proyectoActivo();
    if (!p?.id) return;
    await this.contabilidadService.eliminarPago(p.id, p, pagoId);
  }

  async onGastoAgregado(gasto: Omit<Gasto, 'id'>): Promise<void> {
    const p = this.proyectoActivo();
    if (!p?.id) return;
    this.guardando.set(true);
    try {
      await this.contabilidadService.agregarGasto(p.id, p, gasto);
      this.error.set(null);
    } catch (e: any) {
      this.error.set('Error al guardar el gasto.');
    } finally {
      this.guardando.set(false);
    }
  }

  async onGastoEliminado(gastoId: string): Promise<void> {
    const p = this.proyectoActivo();
    if (!p?.id) return;
    await this.contabilidadService.eliminarGasto(p.id, p, gastoId);
  }

  estadoBadge(estado: string): string {
    const map: Record<string, string> = {
      sin_presupuesto:    'bg-secondary',
      presupuestado:      'bg-info text-dark',
      parcialmente_pagado:'bg-warning text-dark',
      pagado:             'bg-success',
      cerrado:            'bg-dark',
    };
    return map[estado] ?? 'bg-secondary';
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      sin_presupuesto:    'Sin presupuesto',
      presupuestado:      'Presupuestado',
      parcialmente_pagado:'Parcialmente pagado',
      pagado:             'Pagado',
      cerrado:            'Cerrado',
    };
    return map[estado] ?? estado;
  }

  formatCOP(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }
}
