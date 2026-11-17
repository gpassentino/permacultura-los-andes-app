import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS } from '../../../shared/models/proyecto-flujo.model';
import { diasEnEtapa, estaEstancado, proximoPasoVencido } from '../../../shared/logic/flujo';
import { CampoOrden, FilaLista, ordenarFilas } from '../../../shared/logic/tablero';
import { formatoCOP } from '../../../shared/utils/formato';
import { CsvColumn, CsvExportService } from '../../../services/csv-export.service';
import { ProyectoVista } from '../proyecto-vista';

/** Valor contratado y pagado por proyecto (solo usuarios de Contabilidad). */
export type CobrosPorProyecto = ReadonlyMap<string, { valor: number; pagado: number }>;

@Component({
  selector: 'app-proyectos-lista',
  imports: [DatePipe],
  templateUrl: './proyectos-lista.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectosListaComponent {
  readonly proyectos = input.required<ProyectoVista[]>();
  /** null = el usuario no tiene acceso a Contabilidad: no se muestran columnas de dinero. */
  readonly cobros    = input<CobrosPorProyecto | null>(null);
  readonly abrir     = output<string>();

  private csv = inject(CsvExportService);

  readonly ETAPAS_FLUJO_LABELS = ETAPAS_FLUJO_LABELS;
  readonly ETAPAS_EJECUCION_LABELS = ETAPAS_EJECUCION_LABELS;
  readonly formatoCOP = formatoCOP;

  readonly campo = signal<CampoOrden>('dias');
  readonly asc   = signal(false);

  private readonly ahora = new Date();

  private readonly porId = computed(() => new Map(this.proyectos().map(p => [p.id, p])));

  readonly filas = computed<FilaLista[]>(() => {
    const cobros = this.cobros();
    const filas = this.proyectos().map(p => ({
      id:               p.id,
      codigo:           p.codigo,
      proyecto:         p.nombreProyecto,
      contacto:         p.contactoNombre,
      etapa:            p.etapaFlujo,
      etapaEjecucion:   p.etapaEjecucion,
      servicios:        p.servicios.map(s => s.nombre).join(', '),
      dias:             diasEnEtapa(p, this.ahora) ?? 0,
      proximoPaso:      p.proximoPaso?.texto ?? '',
      proximoPasoFecha: p.proximoPaso?.fecha ?? null,
      valor:            cobros ? (cobros.get(p.id)?.valor ?? null) : null,
      pagado:           cobros ? (cobros.get(p.id)?.pagado ?? null) : null,
    }));
    return ordenarFilas(filas, this.campo(), this.asc());
  });

  ordenar(campo: CampoOrden): void {
    if (this.campo() === campo) this.asc.update(a => !a);
    else { this.campo.set(campo); this.asc.set(campo !== 'dias'); }
  }

  ariaSort(campo: CampoOrden): 'ascending' | 'descending' | 'none' {
    if (this.campo() !== campo) return 'none';
    return this.asc() ? 'ascending' : 'descending';
  }

  estancado(id: string): boolean {
    const p = this.porId().get(id);
    return !!p && estaEstancado(p, this.ahora);
  }

  pasoVencido(id: string): boolean {
    const p = this.porId().get(id);
    return !!p && proximoPasoVencido(p, this.ahora);
  }

  exportar(): void {
    const columnas: CsvColumn<FilaLista>[] = [
      { header: 'Código',       value: f => f.codigo },
      { header: 'Proyecto',     value: f => f.proyecto },
      { header: 'Contacto',     value: f => f.contacto },
      { header: 'Etapa',        value: f => ETAPAS_FLUJO_LABELS[f.etapa] },
      { header: 'Ejecución',    value: f => (f.etapaEjecucion ? ETAPAS_EJECUCION_LABELS[f.etapaEjecucion] : '') },
      { header: 'Servicios',    value: f => f.servicios },
      { header: 'Días en etapa', value: f => f.dias },
      { header: 'Próximo paso', value: f => f.proximoPaso },
      { header: 'Fecha próximo paso', value: f => f.proximoPasoFecha },
    ];
    if (this.cobros()) {
      columnas.push(
        { header: 'Valor contratado', value: f => f.valor ?? '' },
        { header: 'Pagado',           value: f => f.pagado ?? '' },
      );
    }
    const stamp = new Date().toISOString().slice(0, 10);
    this.csv.exportToCsv(`proyectos_${stamp}.csv`, columnas, this.filas());
  }
}
