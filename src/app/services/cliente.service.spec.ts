import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { ClienteService } from './cliente.service';
import { Cliente } from '../shared/models/cliente.model';

const {
  mockCollectionData, mockAddDoc, mockUpdateDoc, mockDeleteDoc,
  mockDoc, mockCollection, mockQuery, mockOrderBy, mockServerTimestamp,
} = vi.hoisted(() => ({
  mockCollectionData: vi.fn(),
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockCollection: vi.fn(),
  mockQuery: vi.fn(),
  mockOrderBy: vi.fn(),
  mockServerTimestamp: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: (...args: unknown[]) => mockCollection(...args),
  collectionData: (...args: unknown[]) => mockCollectionData(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) }) },
}));

vi.mock('@angular/fire/auth', () => ({
  Auth: class {},
}));

describe('ClienteService', () => {
  let service: ClienteService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('clientes-col');
    mockQuery.mockReturnValue('clientes-query');
    mockDoc.mockReturnValue({ id: 'test-doc' });
    mockAddDoc.mockResolvedValue({ id: 'new-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockServerTimestamp.mockReturnValue('SERVER_TS');

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { currentUser: { email: 'test@test.com' } } },
        { provide: Firestore, useValue: {} },
      ],
    });
    service = TestBed.inject(ClienteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getClientes', () => {
    it('should return mapped clients with Date objects', () => {
      const now = new Date();
      const firestoreData = new BehaviorSubject([
        {
          id: '1',
          nombre: 'Test',
          tipoProyecto: '',
          municipio: 'El Retiro',
          whatsapp: '3001234567',
          fechaUltimoContacto: { toDate: () => now },
          fechaEstimadaInicio: null,
          notas: 'Note',
          documentos: [],
          recordatorioFecha: null,
          recordatorioMensaje: '',
          estado: 'Contacto Inicial',
          creadoEn: { toDate: () => now },
          creadoPor: 'user@test.com',
          actualizadoEn: { toDate: () => now },
        },
      ]);
      mockCollectionData.mockReturnValue(firestoreData);

      const clientes: Cliente[] = [];
      service.getClientes().subscribe(c => clientes.push(...c));

      expect(clientes).toHaveLength(1);
      expect(clientes[0].nombre).toBe('Test');
      expect(clientes[0].fechaUltimoContacto).toBeInstanceOf(Date);
      expect(clientes[0].municipio).toBe('El Retiro');
    });

    it('should handle null date fields gracefully', () => {
      const firestoreData = new BehaviorSubject([
        {
          id: '2',
          nombre: 'No Dates',
          tipoProyecto: '',
          municipio: '',
          whatsapp: '',
          fechaUltimoContacto: null,
          fechaEstimadaInicio: null,
          notas: '',
          documentos: null,
          recordatorioFecha: null,
          recordatorioMensaje: '',
          estado: 'Contacto Inicial',
          creadoEn: null,
          creadoPor: '',
          actualizadoEn: null,
        },
      ]);
      mockCollectionData.mockReturnValue(firestoreData);

      const clientes: Cliente[] = [];
      service.getClientes().subscribe(c => clientes.push(...c));

      expect(clientes[0].fechaUltimoContacto).toBeNull();
      expect(clientes[0].fechaEstimadaInicio).toBeNull();
      expect(clientes[0].documentos).toEqual([]);
      expect(clientes[0].creadoEn).toBeInstanceOf(Date);
    });
  });

  describe('addCliente', () => {
    it('should call addDoc with server timestamps', async () => {
      await service.addCliente({ nombre: 'Nuevo' });
      expect(mockAddDoc).toHaveBeenCalled();
      const args = mockAddDoc.mock.calls[0];
      expect(args[1]).toMatchObject({ nombre: 'Nuevo', creadoEn: 'SERVER_TS', actualizadoEn: 'SERVER_TS' });
    });
  });

  describe('updateCliente', () => {
    it('should call updateDoc with actualizadoEn', async () => {
      await service.updateCliente('id-1', { nombre: 'Updated' });
      expect(mockUpdateDoc).toHaveBeenCalled();
      const args = mockUpdateDoc.mock.calls[0];
      expect(args[1]).toMatchObject({ nombre: 'Updated', actualizadoEn: 'SERVER_TS' });
    });
  });

  describe('deleteCliente', () => {
    it('should call deleteDoc', async () => {
      await service.deleteCliente('id-1');
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
