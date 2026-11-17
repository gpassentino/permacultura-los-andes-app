import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDropListGroup,
} from '@angular/cdk/drag-drop';

import { ProyectoFlujoService } from '../../services/proyecto-flujo.service';
import { ContactoService } from '../../services/contacto.service';
import { ServicioService } from '../../services/servicio.service';
import { ClienteService } from '../../services/cliente.service';
import {
  Carril, ETAPAS_EJECUCION, ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS,
  EtapaEjecucion, EtapaFlujo, FASES_FLUJO,
} from '../../shared/models/proyecto-flujo.model';
import { TIPOS_SERVICIO_EJECUCION } from '../../shared/models/servicio.model';
import { avisosAlMover, ContextoMovimiento, proximoPasoVencido } from '../../shared/logic/flujo';
import {
  agruparDiseno, agruparEjecucion, ETAPAS_CERRADAS, filtrarProyectos, indicadores,
} from '../../shared/logic/tablero';
import { ClienteCardComponent } from '../../shared/components/cliente-card/cliente-card.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { MoverSheetComponent } from './mover-sheet/mover-sheet.component';
import { ProyectoFichaComponent } from './proyecto-ficha/proyecto-ficha.component';
import { ProyectoFormComponent } from './proyecto-form/proyecto-form.component';
import { ProyectosListaComponent } from './proyectos-lista/proyectos-lista.component';
import { ProyectoVista, ServicioRef } from './proyecto-vista';

type Vista = 'tablero' | 'lista';

interface DatosDrop {
  carril: Carril;
  etapa: EtapaFlujo | EtapaEjecucion;
}

interface EstadoMover {
  id: string;
  carril: Carril;
  destino: EtapaFlujo | EtapaEjecucion | null;
}

@Component({
  selector: 'app-tablero',
  imports: [
    FormsModule,
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder,
    ClienteCardComponent, StatCardComponent,
    MoverSheetComponent, ProyectoFichaComponent, ProyectoFormComponent, ProyectosListaComponent,
  ],
  templateUrl: './tablero.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableroComponent {
  private proyectoService = inject(ProyectoFlujoService);
  private contactoService = inject(ContactoService);
  private servicioService = inject(ServicioService);
  private clienteService  = inject(ClienteService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  readonly FASES = FASES_FLUJO;
  readonly ETAPAS_EJECUCION = ETAPAS_EJECUCION;
  readonly ETAPAS_FLUJO_LABELS = ETAPAS_FLUJO_LABELS;
  readonly ETAPAS_EJECUCION_LABELS = ETAPAS_EJECUCION_LABELS;
  readonly ETAPAS_CERRADAS = ETAPAS_CERRADAS;

  // ── Datos ──────────────────────────────────────────────────────────────────
  private readonly proyectosRaw = toSignal(this.proyectoService.getProyectos());
  private readonly contactos    = toSignal(this.contactoService.getContactos(), { initialValue: [] });
  private readonly servicios    = toSignal(this.servicioService.getServicios(), { initialValue: [] });
  /** Registros anteriores: copia de nombre/teléfono de respaldo y "Datos anteriores". */
  private readonly clientes     = toSignal(this.clienteService.getClientes(), { initialValue: [] });
  private readonly queryParams  = toSignal(this.route.queryParamMap);

  readonly loading = computed(() => this.proyectosRaw() === undefined);

  readonly catalogo = computed<ServicioRef[]>(() =>
    this.servicios().filter(s => s.id).map(s => ({ id: s.id!, nombre: s.nombre, tipo: s.tipo })));

  readonly servicioIdsEjecucion = computed(() =>
    this.catalogo().filter(s => TIPOS_SERVICIO_EJECUCION.includes(s.tipo)).map(s => s.id));

  private readonly contactoPorId = computed(() => new Map(this.contactos().map(c => [c.id!, c])));
  private readonly clientePorId  = computed(() => new Map(this.clientes().map(c => [c.id!, c])));

  /** Proyectos cruzados en memoria con contacto y servicios. */
  readonly proyectos = computed<ProyectoVista[]>(() => {
    const contactos = this.contactoPorId();
    const clientes  = this.clientePorId();
    const servicios = new Map(this.catalogo().map(s => [s.id, s]));
    return (this.proyectosRaw() ?? []).filter(p => p.id).map(p => {
      const c = contactos.get(p.contactoId);
      const respaldo = !c && p.clienteIdLegacy ? clientes.get(p.clienteIdLegacy) : undefined;
      return {
        ...p,
        id: p.id!,
        contactoNombre:   c?.name ?? respaldo?.nombre ?? '',
        contactoTelefono: c?.phone ?? respaldo?.whatsapp ?? '',
        contactoDesdeRespaldo: !c && !!respaldo,
        servicios: p.servicioIds.map(id => servicios.get(id)).filter((s): s is ServicioRef => !!s),
      };
    });
  });

  readonly codigosUsados = computed(() => new Set(this.proyectos().map(p => p.codigo)));

  // ── Filtros y vista ────────────────────────────────────────────────────────
  readonly texto             = signal('');
  readonly servicioId        = signal<string | null>(null);
  readonly soloEstancados    = signal(false);
  readonly mostrarArchivados = signal(false);
  readonly vista             = signal<Vista>('tablero');
  readonly ejecucionAbierta  = signal(true);
  /** Encabezados plegados en la lista de celular (clave: etapa). */
  readonly plegados          = signal<ReadonlySet<string>>(new Set());

  private readonly ahora = new Date();

  readonly filtrados = computed(() =>
    filtrarProyectos(
      this.proyectos(),
      { texto: this.texto(), servicioId: this.servicioId(), soloEstancados: this.soloEstancados() },
      p => p.contactoNombre,
      this.ahora,
    ));

  readonly porEtapa     = computed(() => agruparDiseno(this.filtrados(), this.ahora));
  readonly porEjecucion = computed(() => agruparEjecucion(this.filtrados(), this.ahora));
  readonly hayEjecucion = computed(() => [...this.porEjecucion().values()].some(l => l.length > 0));
  readonly stats        = computed(() => indicadores(this.proyectos(), this.ahora));

  /** Para Lista: sin archivados salvo que se pidan. */
  readonly paraLista = computed(() =>
    this.mostrarArchivados() ? this.filtrados() : this.filtrados().filter(p => !ETAPAS_CERRADAS.includes(p.etapaFlujo)));

  readonly conteoFase = (etapas: readonly EtapaFlujo[]) =>
    etapas.reduce((s, e) => s + (this.porEtapa().get(e)?.length ?? 0), 0);

  /** Próximos pasos vencidos o para hoy (banner). */
  readonly pasosUrgentes = computed(() => {
    const finHoy = new Date(this.ahora.getFullYear(), this.ahora.getMonth(), this.ahora.getDate() + 1);
    return this.proyectos()
      .filter(p => !ETAPAS_CERRADAS.includes(p.etapaFlujo) && p.proximoPaso?.fecha && p.proximoPaso.fecha < finHoy)
      .sort((a, b) => a.proximoPaso!.fecha!.getTime() - b.proximoPaso!.fecha!.getTime());
  });

  pasoVencido(p: ProyectoVista): boolean {
    return proximoPasoVencido(p, this.ahora);
  }

  togglePlegado(clave: string): void {
    const s = new Set(this.plegados());
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    this.plegados.set(s);
  }

  toggleEstancados(): void {
    this.soloEstancados.update(v => !v);
  }

  // ── Ficha, mover, nuevo ────────────────────────────────────────────────────
  readonly fichaId    = signal<string | null>(null);
  readonly mover      = signal<EstadoMover | null>(null);
  readonly mostrarNuevo = signal(false);
  readonly error      = signal<string | null>(null);

  readonly fichaProyecto = computed(() => this.proyectos().find(p => p.id === this.fichaId()) ?? null);
  readonly fichaContacto = computed(() => {
    const p = this.fichaProyecto();
    return p ? this.contactoPorId().get(p.contactoId) ?? null : null;
  });
  readonly fichaCliente = computed(() => {
    const p = this.fichaProyecto();
    return p?.clienteIdLegacy ? this.clientePorId().get(p.clienteIdLegacy) ?? null : null;
  });
  readonly moverProyecto = computed(() => {
    const m = this.mover();
    return m ? this.proyectos().find(p => p.id === m.id) ?? null : null;
  });

  /** Contexto de los avisos al mover. Contabilidad se conecta en el PR (c). */
  contextoMovimiento(_p: ProyectoVista): ContextoMovimiento {
    return { esContabilidad: false };
  }

  // Abre la ficha por ?proyectoId= o ?clienteId= (mismo id tras la migración)
  private readonly abiertoPor = signal<string | null>(null);
  private readonly deepLink = effect(() => {
    const qp = this.queryParams();
    const id = qp?.get('proyectoId') ?? qp?.get('clienteId');
    if (!id || this.abiertoPor() === id) return;
    if (this.proyectos().some(p => p.id === id)) {
      this.abiertoPor.set(id);
      this.fichaId.set(id);
    }
  });

  abrirFicha(id: string): void {
    this.fichaId.set(id);
  }

  cerrarFicha(): void {
    this.fichaId.set(null);
    if (this.queryParams()?.keys.length) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
  }

  abrirMover(id: string, carril: Carril, destino: EtapaFlujo | EtapaEjecucion | null = null): void {
    this.mover.set({ id, carril, destino });
  }

  onCreado(id: string): void {
    this.mostrarNuevo.set(false);
    this.fichaId.set(id);
  }

  // ── Arrastrar y soltar (escritorio) ────────────────────────────────────────
  // CdkDropList es invariante en su tipo de datos: se recibe `any` y se tipa aquí.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onDrop(event: CdkDragDrop<any, any>): Promise<void> {
    if (event.previousContainer === event.container) return;
    const p: ProyectoVista = event.item.data;
    const destino = event.container.data as DatosDrop;
    const origen  = event.previousContainer.data as DatosDrop;
    const carril  = destino.carril;
    const etapa   = destino.etapa;
    // No se arrastra entre carriles (diseño ↔ ejecución)
    if (origen.carril !== carril) return;

    // Con avisos o motivo obligatorio, se abre la hoja con el destino ya elegido
    if (carril === 'diseno') {
      const r = avisosAlMover(p, etapa as EtapaFlujo, this.contextoMovimiento(p));
      if (r.avisos.length || r.requiereMotivoCierre || r.ofrecerPortafolio) {
        this.abrirMover(p.id, carril, etapa);
        return;
      }
    }
    try {
      this.error.set(null);
      await this.proyectoService.moverEtapa(p.id, carril, etapa, { servicioIdsEjecucion: this.servicioIdsEjecucion() });
    } catch {
      this.error.set('No se pudo mover el proyecto. Intenta de nuevo.');
    }
  }
}
