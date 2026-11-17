import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Carril, ETAPAS_EJECUCION, ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS, EtapaEjecucion, EtapaFlujo,
  FASES_FLUJO, MOTIVOS_CIERRE, MOTIVOS_CIERRE_LABELS, MotivoCierre,
} from '../../../shared/models/proyecto-flujo.model';
import { avisosAlMover, ContextoMovimiento } from '../../../shared/logic/flujo';
import { ProyectoFlujoService } from '../../../services/proyecto-flujo.service';
import { PortafolioService } from '../../../services/portafolio.service';
import { ProyectoVista } from '../proyecto-vista';

type Paso = 'elegir' | 'avisos' | 'motivo' | 'portafolio';

@Component({
  selector: 'app-mover-sheet',
  imports: [FormsModule],
  templateUrl: './mover-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoverSheetComponent implements OnInit {
  readonly proyecto = input.required<ProyectoVista>();
  readonly carril   = input<Carril>('diseno');
  readonly contexto = input<ContextoMovimiento>({ esContabilidad: false });
  /** Ids del catálogo que activan el carril de ejecución. */
  readonly servicioIdsEjecucion = input<readonly string[]>([]);
  /** Destino ya elegido (al soltar una tarjeta en escritorio): salta a avisos/motivo. */
  readonly destinoInicial = input<EtapaFlujo | EtapaEjecucion | null>(null);
  readonly cerrar   = output<void>();

  private proyectoService   = inject(ProyectoFlujoService);
  private portafolioService = inject(PortafolioService);

  readonly FASES = FASES_FLUJO;
  readonly ETAPAS_FLUJO_LABELS = ETAPAS_FLUJO_LABELS;
  readonly ETAPAS_EJECUCION = ETAPAS_EJECUCION;
  readonly ETAPAS_EJECUCION_LABELS = ETAPAS_EJECUCION_LABELS;
  readonly MOTIVOS = MOTIVOS_CIERRE;
  readonly MOTIVOS_LABELS = MOTIVOS_CIERRE_LABELS;

  readonly paso    = signal<Paso>('elegir');
  readonly destino = signal<EtapaFlujo | EtapaEjecucion | null>(null);
  readonly avisos  = signal<string[]>([]);
  readonly motivo  = signal<MotivoCierre | ''>('');
  readonly motivoDetalle = signal('');
  readonly guardando = signal(false);
  readonly error   = signal<string | null>(null);
  readonly portafolioExistenteId = signal('');

  readonly portafolios = toSignal(this.portafolioService.getProyectos(), { initialValue: [] });

  readonly etapaActual = computed(() =>
    this.carril() === 'ejecucion' ? this.proyecto().etapaEjecucion : this.proyecto().etapaFlujo);

  readonly titulo = computed(() =>
    this.carril() === 'ejecucion' ? 'Mover en el carril de ejecución' : 'Mover a…');

  readonly motivoValido = computed(() =>
    !!this.motivo() && (this.motivo() !== 'otro' || this.motivoDetalle().trim().length > 0));

  ngOnInit(): void {
    const d = this.destinoInicial();
    if (d) this.elegir(d);
  }

  elegir(destino: EtapaFlujo | EtapaEjecucion): void {
    if (destino === this.etapaActual()) return;
    this.destino.set(destino);
    this.error.set(null);

    if (this.carril() === 'ejecucion') {
      this.mover();
      return;
    }
    const r = avisosAlMover(this.proyecto(), destino as EtapaFlujo, this.contexto());
    if (r.requiereMotivoCierre) {
      this.paso.set('motivo');
    } else if (r.avisos.length) {
      this.avisos.set(r.avisos);
      this.paso.set('avisos');
    } else {
      this.mover();
    }
  }

  volver(): void {
    this.paso.set('elegir');
    this.destino.set(null);
    this.avisos.set([]);
  }

  async mover(): Promise<void> {
    const destino = this.destino();
    if (!destino || this.guardando()) return;
    const motivoCierre = destino === 'no_se_dio'
      ? (this.motivo() === 'otro' ? `otro: ${this.motivoDetalle().trim()}` : this.motivo())
      : undefined;

    this.guardando.set(true);
    try {
      await this.proyectoService.moverEtapa(this.proyecto().id, this.carril(), destino, {
        motivoCierre: motivoCierre || undefined,
        servicioIdsEjecucion: this.servicioIdsEjecucion(),
      });
      const ofrecer = this.carril() === 'diseno'
        && avisosAlMover(this.proyecto(), destino as EtapaFlujo, this.contexto()).ofrecerPortafolio;
      if (ofrecer) this.paso.set('portafolio');
      else this.cerrar.emit();
    } catch {
      this.error.set('No se pudo mover el proyecto. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  /** Crea un borrador en Portafolio (inactivo) y lo enlaza. */
  async crearFichaPortafolio(): Promise<void> {
    const p = this.proyecto();
    const id = crypto.randomUUID();
    this.guardando.set(true);
    try {
      await this.portafolioService.saveProyecto(id, {
        nombre: p.nombreProyecto,
        descripcion: '',
        ubicacion: p.municipio ?? '',
        anio: new Date().getFullYear(),
        tipoProyecto: 'otro',
        fotos: [],
        fotoPortadaIndex: 0,
        destacado: false,
        orden: 999,
        activo: false,
      }, true);
      await this.proyectoService.actualizarProyecto(p.id, { portafolioProyectoId: id });
      this.cerrar.emit();
    } catch {
      this.error.set('No se pudo crear la ficha en Portafolio.');
    } finally {
      this.guardando.set(false);
    }
  }

  async enlazarPortafolio(): Promise<void> {
    const id = this.portafolioExistenteId();
    if (!id) return;
    this.guardando.set(true);
    try {
      await this.proyectoService.actualizarProyecto(this.proyecto().id, { portafolioProyectoId: id });
      this.cerrar.emit();
    } catch {
      this.error.set('No se pudo enlazar la ficha de Portafolio.');
    } finally {
      this.guardando.set(false);
    }
  }
}
