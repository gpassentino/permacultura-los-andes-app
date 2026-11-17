import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

import { TableroComponent } from './tablero.component';
import { ProyectoFlujoService } from '../../services/proyecto-flujo.service';
import { ContactoService } from '../../services/contacto.service';
import { ServicioService } from '../../services/servicio.service';
import { ClienteService } from '../../services/cliente.service';
import { ProyectoFlujo } from '../../shared/models/proyecto-flujo.model';

registerLocaleData(localeEsCO);

const hace = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

function proyecto(id: string, over: Partial<ProyectoFlujo> = {}): ProyectoFlujo {
  return {
    id, contactoId: 'k1', codigo: 'PLA-' + id.toUpperCase().padEnd(3, 'X').slice(0, 3), nombreProyecto: `Proyecto ${id}`,
    etapaFlujo: 'propuesta', etapaFlujoDesde: hace(1), etapaEjecucion: null, servicioIds: [],
    visitaTecnica: 'no_aplica', documentos: [], historial: [], creadoEn: hace(5), creadoPor: '',
    actualizadoEn: hace(1), ...over,
  };
}

describe('TableroComponent', () => {
  let proyectos$: BehaviorSubject<ProyectoFlujo[]>;
  let query$: BehaviorSubject<ParamMap>;
  let mockProyectos: { getProyectos: ReturnType<typeof vi.fn>; moverEtapa: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    proyectos$ = new BehaviorSubject<ProyectoFlujo[]>([]);
    query$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    mockProyectos = {
      getProyectos: vi.fn().mockReturnValue(proyectos$),
      moverEtapa: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TableroComponent],
      providers: [
        { provide: ProyectoFlujoService, useValue: mockProyectos },
        { provide: ContactoService, useValue: {
          getContactos: () => of([{ id: 'k1', name: 'Ana Restrepo', phone: '+573001112233' }]),
        } },
        { provide: ServicioService, useValue: {
          getServicios: () => of([
            { id: 's-ejec', nombre: 'Ejecución', tipo: 'ejecucion' },
            { id: 's-conc', nombre: 'Diseño conceptual', tipo: 'informe_vision' },
          ]),
        } },
        { provide: ClienteService, useValue: {
          getClientes: () => of([{ id: 'legacy1', nombre: 'Luis (copia)', whatsapp: '300' }]),
        } },
        { provide: ActivatedRoute, useValue: { queryParamMap: query$ } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    }).compileComponents();
  });

  function crear(): TableroComponent {
    const fixture = TestBed.createComponent(TableroComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('muestra cargando hasta que llegan los proyectos', () => {
    const c = crear();
    expect(c.loading()).toBe(false); // BehaviorSubject emite [] de inmediato
  });

  it('cruza el contacto desde contacts y los nombres de servicios', () => {
    proyectos$.next([proyecto('a', { servicioIds: ['s-conc', 'no-existe'] })]);
    const c = crear();
    const p = c.proyectos()[0];
    expect(p.contactoNombre).toBe('Ana Restrepo');
    expect(p.contactoDesdeRespaldo).toBe(false);
    expect(p.servicios.map(s => s.nombre)).toEqual(['Diseño conceptual']);
  });

  it('usa la copia de clientes como respaldo si el contacto no existe', () => {
    proyectos$.next([proyecto('b', { contactoId: 'borrado', clienteIdLegacy: 'legacy1' })]);
    const p = crear().proyectos()[0];
    expect(p.contactoNombre).toBe('Luis (copia)');
    expect(p.contactoDesdeRespaldo).toBe(true);
  });

  it('identifica los servicios de ejecución', () => {
    expect(crear().servicioIdsEjecucion()).toEqual(['s-ejec']);
  });

  it('indicadores y filtro de estancados', () => {
    proyectos$.next([
      proyecto('a'),
      proyecto('b', { etapaFlujoDesde: hace(30) }),
      proyecto('c', { etapaFlujo: 'diseno' }),
    ]);
    const c = crear();
    expect(c.stats()).toEqual({ propuestasAbiertas: 2, enDiseno: 1, estancados: 1 });
    c.toggleEstancados();
    expect(c.filtrados().map(p => p.id)).toEqual(['b']);
  });

  it('la lista oculta archivados salvo que se pidan', () => {
    proyectos$.next([proyecto('a'), proyecto('b', { etapaFlujo: 'archivado' }), proyecto('c', { etapaFlujo: 'no_se_dio', motivoCierre: 'precio' })]);
    const c = crear();
    expect(c.paraLista().map(p => p.id)).toEqual(['a']);
    c.mostrarArchivados.set(true);
    expect(c.paraLista()).toHaveLength(3);
  });

  it('abre la ficha por ?clienteId= (mismo id tras la migración)', () => {
    proyectos$.next([proyecto('legacy1')]);
    query$.next(convertToParamMap({ clienteId: 'legacy1' }));
    const c = crear();
    TestBed.tick();
    expect(c.fichaId()).toBe('legacy1');
    expect(c.fichaProyecto()?.id).toBe('legacy1');
  });

  it('al soltar sin avisos mueve directo; con avisos abre la hoja con el destino', async () => {
    proyectos$.next([proyecto('a', { etapaFlujo: 'contacto' })]);
    const c = crear();
    const p = c.proyectos()[0];
    const drop = (etapa: string) => ({
      previousContainer: { data: { carril: 'diseno', etapa: 'contacto' } },
      container: { data: { carril: 'diseno', etapa } },
      item: { data: p },
    }) as any;

    await c.onDrop(drop('propuesta'));
    expect(mockProyectos.moverEtapa).toHaveBeenCalledWith('a', 'diseno', 'propuesta', { servicioIdsEjecucion: ['s-ejec'] });

    await c.onDrop(drop('diseno')); // sin contrato → aviso
    expect(c.mover()).toEqual({ id: 'a', carril: 'diseno', destino: 'diseno' });
    expect(mockProyectos.moverEtapa).toHaveBeenCalledTimes(1);
  });

  it('no permite arrastrar entre carriles', async () => {
    proyectos$.next([proyecto('a', { etapaEjecucion: 'en_obra', etapaEjecucionDesde: hace(1) })]);
    const c = crear();
    await c.onDrop({
      previousContainer: { data: { carril: 'ejecucion', etapa: 'en_obra' } },
      container: { data: { carril: 'diseno', etapa: 'contrato' } },
      item: { data: c.proyectos()[0] },
    } as any);
    expect(mockProyectos.moverEtapa).not.toHaveBeenCalled();
  });
});
