import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { BehaviorSubject } from 'rxjs';

import { AcademiaComponent } from './academia.component';
import { TallerService } from '../../services/taller.service';
import { Taller } from '../../shared/models/taller.model';

registerLocaleData(localeEsCO);

function makeTaller(overrides: Partial<Taller> = {}): Taller {
  return {
    id: 't1',
    nombre: 'PDC',
    numero: 1,
    fechaInicio: new Date(),
    fechaFin: null,
    ubicacion: 'Finca',
    municipio: 'El Retiro',
    cupoMaximo: 20,
    precio: 100000,
    descripcion: '',
    estado: 'Próximo',
    enlaceReserva: '',
    notasInternas: '',
    participantesCount: 0,
    totalRecaudado: 0,
    creadoEn: new Date(),
    ...overrides,
  };
}

describe('AcademiaComponent', () => {
  let talleresSubject: BehaviorSubject<Taller[]>;
  let mockService: {
    getTalleres: ReturnType<typeof vi.fn>;
    addTaller: ReturnType<typeof vi.fn>;
    updateTaller: ReturnType<typeof vi.fn>;
    deleteTaller: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    talleresSubject = new BehaviorSubject<Taller[]>([]);
    mockService = {
      getTalleres: vi.fn().mockReturnValue(talleresSubject),
      addTaller: vi.fn().mockResolvedValue('new-id'),
      updateTaller: vi.fn().mockResolvedValue(undefined),
      deleteTaller: vi.fn().mockResolvedValue(undefined),
    };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AcademiaComponent],
      providers: [
        { provide: TallerService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    }).compileComponents();
  });

  function createComponent(): AcademiaComponent {
    const fixture = TestBed.createComponent(AcademiaComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('loading', () => {
    it('is false once data arrives', () => {
      talleresSubject.next([]);
      const c = createComponent();
      expect(c.loading()).toBe(false);
    });
  });

  describe('stats', () => {
    it('computes totals from denormalized fields', () => {
      talleresSubject.next([
        makeTaller({ id: '1', participantesCount: 10, totalRecaudado: 1_000_000, estado: 'Finalizado' }),
        makeTaller({ id: '2', participantesCount: 5,  totalRecaudado: 500_000,  estado: 'Próximo' }),
        makeTaller({ id: '3', participantesCount: 3,  totalRecaudado: 300_000,  estado: 'Finalizado' }),
      ]);
      const c = createComponent();
      expect(c.totalTalleres()).toBe(3);
      expect(c.totalParticipantes()).toBe(18);
      expect(c.totalRecaudado()).toBe(1_800_000);
      expect(c.talleresFinalizados()).toBe(2);
    });

    it('returns zero when there are no talleres', () => {
      talleresSubject.next([]);
      const c = createComponent();
      expect(c.totalTalleres()).toBe(0);
      expect(c.totalParticipantes()).toBe(0);
      expect(c.totalRecaudado()).toBe(0);
      expect(c.talleresFinalizados()).toBe(0);
    });
  });

  describe('modal', () => {
    it('openNuevoTaller opens with no taller selected', () => {
      const c = createComponent();
      c.openNuevoTaller();
      expect(c.showModal()).toBe(true);
      expect(c.selectedTaller()).toBeNull();
    });

    it('openEditarTaller stops propagation and selects taller', () => {
      const c = createComponent();
      const stop = vi.fn();
      const taller = makeTaller();
      c.openEditarTaller(taller, { stopPropagation: stop } as unknown as MouseEvent);
      expect(stop).toHaveBeenCalled();
      expect(c.selectedTaller()).toBe(taller);
      expect(c.showModal()).toBe(true);
    });

    it('closeModal resets selection and hides modal', () => {
      const c = createComponent();
      c.openEditarTaller(makeTaller(), { stopPropagation: () => {} } as MouseEvent);
      c.closeModal();
      expect(c.showModal()).toBe(false);
      expect(c.selectedTaller()).toBeNull();
    });
  });

  describe('navigation', () => {
    it('goToDetalle navigates by taller id', () => {
      const c = createComponent();
      c.goToDetalle(makeTaller({ id: 'abc' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/academia', 'abc']);
    });
  });

  describe('onGuardar', () => {
    it('calls addTaller when no id', async () => {
      const c = createComponent();
      await c.onGuardar({ data: { nombre: 'New' } });
      expect(mockService.addTaller).toHaveBeenCalledWith({ nombre: 'New' });
    });

    it('calls updateTaller when id present', async () => {
      const c = createComponent();
      await c.onGuardar({ data: { nombre: 'Up' }, id: 't1' });
      expect(mockService.updateTaller).toHaveBeenCalledWith('t1', { nombre: 'Up' });
    });

    it('sets error on failure', async () => {
      mockService.addTaller.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onGuardar({ data: { nombre: 'X' } });
      expect(c.error()).toBe('Error al guardar el taller. Intente de nuevo.');
    });
  });

  describe('onEliminar', () => {
    it('calls deleteTaller', async () => {
      const c = createComponent();
      await c.onEliminar('t1');
      expect(mockService.deleteTaller).toHaveBeenCalledWith('t1');
    });

    it('sets error on failure', async () => {
      mockService.deleteTaller.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onEliminar('t1');
      expect(c.error()).toBe('Error al eliminar el taller. Intente de nuevo.');
    });
  });

  describe('display helpers', () => {
    it('ubicacionLabel joins ubicacion + municipio', () => {
      const c = createComponent();
      expect(c.ubicacionLabel(makeTaller({ ubicacion: 'Finca X', municipio: 'El Retiro' })))
        .toBe('Finca X, El Retiro');
    });

    it('ubicacionLabel handles missing fields', () => {
      const c = createComponent();
      expect(c.ubicacionLabel(makeTaller({ ubicacion: 'Solo Finca', municipio: '' }))).toBe('Solo Finca');
      expect(c.ubicacionLabel(makeTaller({ ubicacion: '', municipio: 'Solo Mpio' }))).toBe('Solo Mpio');
    });

    it('estadoBadgeClass returns mapped class for known states', () => {
      const c = createComponent();
      expect(c.estadoBadgeClass('Próximo')).toBe('badge-proximo');
      expect(c.estadoBadgeClass('En Curso')).toBe('badge-en-curso');
      expect(c.estadoBadgeClass('Finalizado')).toBe('badge-finalizado');
      expect(c.estadoBadgeClass('Cancelado')).toBe('badge-cancelado');
    });

    it('estadoBadgeClass falls back for unknown states', () => {
      const c = createComponent();
      expect(c.estadoBadgeClass('Whatever')).toBe('bg-secondary');
    });
  });
});
