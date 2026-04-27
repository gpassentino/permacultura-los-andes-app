import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TableroComponent } from './tablero.component';
import { ClienteService } from '../../services/cliente.service';
import { RecordatorioService } from '../../services/recordatorio.service';
import { Cliente } from '../../shared/models/cliente.model';

function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: '1',
    nombre: 'Test',
    categoria: 'Indefinido', checklist: [],
    municipio: '',
    whatsapp: '',
    fechaUltimoContacto: null,
    fechaEstimadaInicio: null,
    notas: '',
    documentos: [],
    recordatorioFecha: null,
    recordatorioMensaje: '',
    estado: 'Antes',
    creadoEn: new Date(),
    creadoPor: '',
    actualizadoEn: new Date(),
    ...overrides,
  };
}

describe('TableroComponent', () => {
  let clientesSubject: BehaviorSubject<Cliente[]>;
  let mockClienteService: {
    getClientes: ReturnType<typeof vi.fn>;
    addCliente: ReturnType<typeof vi.fn>;
    updateCliente: ReturnType<typeof vi.fn>;
    deleteCliente: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    clientesSubject = new BehaviorSubject<Cliente[]>([]);
    mockClienteService = {
      getClientes: vi.fn().mockReturnValue(clientesSubject),
      addCliente: vi.fn().mockResolvedValue(undefined),
      updateCliente: vi.fn().mockResolvedValue(undefined),
      deleteCliente: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TableroComponent],
      providers: [
        { provide: ClienteService, useValue: mockClienteService },
        RecordatorioService,
      ],
    }).compileComponents();
  });

  function createComponent(): TableroComponent {
    const fixture = TestBed.createComponent(TableroComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('clientesPorColumna', () => {
    it('should group clients by estado', () => {
      clientesSubject.next([
        makeCliente({ id: '1', estado: 'Antes' }),
        makeCliente({ id: '2', estado: 'Antes' }),
        makeCliente({ id: '3', estado: 'Durante' }),
      ]);
      const component = createComponent();
      const map = component.clientesPorColumna();

      expect(map.get('Antes')?.length).toBe(2);
      expect(map.get('Durante')?.length).toBe(1);
      expect(map.get('Completo')?.length).toBe(0);
    });

    it('should have all columns even when empty', () => {
      clientesSubject.next([]);
      const component = createComponent();
      const map = component.clientesPorColumna();

      expect(map.size).toBe(6);
      for (const [, clients] of map) {
        expect(clients.length).toBe(0);
      }
    });
  });

  describe('recordatoriosBanner', () => {
    it('should include past-due reminders', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      clientesSubject.next([
        makeCliente({ id: '1', recordatorioFecha: yesterday }),
      ]);
      const component = createComponent();
      expect(component.recordatoriosBanner().length).toBe(1);
    });

    it('should exclude reminders more than one day out', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      clientesSubject.next([
        makeCliente({ id: '1', recordatorioFecha: nextWeek }),
      ]);
      const component = createComponent();
      expect(component.recordatoriosBanner().length).toBe(0);
    });
  });

  describe('loading', () => {
    it('should be false after data arrives', () => {
      clientesSubject.next([]);
      const component = createComponent();
      expect(component.loading()).toBe(false);
    });
  });

  describe('modal', () => {
    it('should open modal for new client', () => {
      const component = createComponent();
      component.openModal();
      expect(component.showModal()).toBe(true);
      expect(component.selectedCliente()).toBeNull();
    });

    it('should open modal for existing client', () => {
      const cliente = makeCliente();
      const component = createComponent();
      component.openModal(cliente);
      expect(component.showModal()).toBe(true);
      expect(component.selectedCliente()).toBe(cliente);
    });

    it('should close modal and reset state', () => {
      const component = createComponent();
      component.openModal(makeCliente());
      component.closeModal();
      expect(component.showModal()).toBe(false);
      expect(component.selectedCliente()).toBeNull();
    });
  });

  describe('onGuardar', () => {
    it('should call addCliente for new client', async () => {
      const component = createComponent();
      await component.onGuardar({ data: { nombre: 'New' } });
      expect(mockClienteService.addCliente).toHaveBeenCalledWith({ nombre: 'New' });
    });

    it('should call updateCliente for existing client', async () => {
      const component = createComponent();
      await component.onGuardar({ data: { nombre: 'Updated' }, id: '1' });
      expect(mockClienteService.updateCliente).toHaveBeenCalledWith('1', { nombre: 'Updated' });
    });

    it('should set error on failure', async () => {
      mockClienteService.addCliente.mockRejectedValue(new Error('fail'));
      const component = createComponent();
      await component.onGuardar({ data: { nombre: 'Bad' } });
      expect(component.error()).toBe('Error al guardar. Intente de nuevo.');
    });
  });

  describe('onEliminar', () => {
    it('should call deleteCliente', async () => {
      const component = createComponent();
      await component.onEliminar('1');
      expect(mockClienteService.deleteCliente).toHaveBeenCalledWith('1');
    });

    it('should set error on failure', async () => {
      mockClienteService.deleteCliente.mockRejectedValue(new Error('fail'));
      const component = createComponent();
      await component.onEliminar('1');
      expect(component.error()).toBe('Error al eliminar. Intente de nuevo.');
    });
  });
});
