import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Firestore } from '@angular/fire/firestore';
import { TallerService } from './taller.service';
import { Participante, Taller } from '../shared/models/taller.model';

const {
  mockCollectionData, mockDocData, mockAddDoc, mockUpdateDoc, mockDeleteDoc,
  mockDoc, mockCollection, mockQuery, mockOrderBy, mockServerTimestamp,
  mockRunTransaction, mockIncrement,
} = vi.hoisted(() => ({
  mockCollectionData: vi.fn(),
  mockDocData: vi.fn(),
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockCollection: vi.fn(),
  mockQuery: vi.fn(),
  mockOrderBy: vi.fn(),
  mockServerTimestamp: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockIncrement: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: (...args: unknown[]) => mockCollection(...args),
  collectionData: (...args: unknown[]) => mockCollectionData(...args),
  docData: (...args: unknown[]) => mockDocData(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => mockServerTimestamp(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  increment: (...args: unknown[]) => mockIncrement(...args),
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) }) },
}));

interface FakeTx {
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function makeFakeTx(): FakeTx {
  return { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

describe('TallerService', () => {
  let service: TallerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('talleres-col');
    mockQuery.mockReturnValue('talleres-query');
    mockDoc.mockImplementation((...args: unknown[]) => ({ id: 'doc-' + args.length }));
    mockAddDoc.mockResolvedValue({ id: 'new-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockServerTimestamp.mockReturnValue('SERVER_TS');
    mockIncrement.mockImplementation((n: number) => ({ __increment: n }));

    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(TallerService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTalleres', () => {
    it('maps Firestore docs and converts dates', () => {
      const now = new Date();
      mockCollectionData.mockReturnValue(new BehaviorSubject([
        {
          id: 't1',
          nombre: 'PDC',
          numero: 5,
          fechaInicio: { toDate: () => now },
          fechaFin: { toDate: () => now },
          ubicacion: 'Finca',
          municipio: 'El Retiro',
          cupoMaximo: 20,
          precio: 100000,
          descripcion: '',
          estado: 'Próximo',
          enlaceReserva: '',
          notasInternas: '',
          participantesCount: 3,
          totalRecaudado: 300000,
          creadoEn: { toDate: () => now },
        },
      ]));

      const out: Taller[] = [];
      service.getTalleres().subscribe(t => out.push(...t));

      expect(out).toHaveLength(1);
      expect(out[0].fechaInicio).toBeInstanceOf(Date);
      expect(out[0].participantesCount).toBe(3);
    });

    it('applies defaults for missing fields', () => {
      mockCollectionData.mockReturnValue(new BehaviorSubject([
        { id: 't2', fechaInicio: null, fechaFin: null, creadoEn: null },
      ]));

      const out: Taller[] = [];
      service.getTalleres().subscribe(t => out.push(...t));

      expect(out[0].nombre).toBe('');
      expect(out[0].estado).toBe('Próximo');
      expect(out[0].participantesCount).toBe(0);
      expect(out[0].fechaInicio).toBeNull();
      expect(out[0].creadoEn).toBeInstanceOf(Date);
    });
  });

  describe('addTaller', () => {
    it('initializes counters and uses serverTimestamp for creadoEn', async () => {
      const id = await service.addTaller({ nombre: 'New' });
      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload).toMatchObject({
        nombre: 'New',
        participantesCount: 0,
        totalRecaudado: 0,
        creadoEn: 'SERVER_TS',
      });
      expect(id).toBe('new-id');
    });

    it('strips counter fields from incoming data', async () => {
      await service.addTaller({
        nombre: 'X',
        id: 'should-strip',
        participantesCount: 99,
        totalRecaudado: 99,
      } as Partial<Taller>);
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['id']).toBeUndefined();
      // counters reset to 0 by service, not 99
      expect(payload['participantesCount']).toBe(0);
      expect(payload['totalRecaudado']).toBe(0);
    });
  });

  describe('updateTaller', () => {
    it('calls updateDoc with mapped data', async () => {
      await service.updateTaller('t1', { nombre: 'Updated' });
      expect(mockUpdateDoc).toHaveBeenCalled();
      const payload = mockUpdateDoc.mock.calls[0][1];
      expect(payload).toMatchObject({ nombre: 'Updated' });
    });
  });

  describe('deleteTaller', () => {
    it('calls deleteDoc', async () => {
      await service.deleteTaller('t1');
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('addParticipante', () => {
    it('adds participante and increments counters by montoPagado when paid', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.addParticipante('t1', {
        nombreCompleto: 'Ana',
        pago: true,
        montoPagado: 50000,
      });

      expect(tx.set).toHaveBeenCalled();
      expect(tx.update).toHaveBeenCalled();
      const counterUpdate = tx.update.mock.calls[0][1];
      expect(counterUpdate).toEqual({
        participantesCount: { __increment: 1 },
        totalRecaudado:     { __increment: 50000 },
      });
    });

    it('increments totalRecaudado by 0 when not paid', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.addParticipante('t1', {
        nombreCompleto: 'Ana',
        pago: false,
        montoPagado: 50000,
      });

      const counterUpdate = tx.update.mock.calls[0][1];
      expect(counterUpdate.totalRecaudado).toEqual({ __increment: 0 });
    });
  });

  describe('updateParticipante', () => {
    function oldPart(overrides: Partial<Participante> = {}): Participante {
      return {
        id: 'p1',
        nombreCompleto: 'Ana',
        whatsapp: '',
        email: '',
        ciudadOrigen: '',
        comoNosConocio: '',
        pago: true,
        montoPagado: 50000,
        notas: '',
        creadoEn: new Date(),
        ...overrides,
      };
    }

    it('updates totalRecaudado by delta when monto changes', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.updateParticipante('t1', 'p1', oldPart(), { montoPagado: 70000 });

      // 2 update calls: participante row + counter delta
      expect(tx.update).toHaveBeenCalledTimes(2);
      const deltaCall = tx.update.mock.calls[1][1];
      expect(deltaCall).toEqual({ totalRecaudado: { __increment: 20000 } });
    });

    it('skips counter update when monto is unchanged', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.updateParticipante('t1', 'p1', oldPart(), { nombreCompleto: 'Ana M.' });

      // only the participante update, no counter update
      expect(tx.update).toHaveBeenCalledTimes(1);
    });

    it('subtracts the full old monto when payment is removed', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.updateParticipante('t1', 'p1', oldPart(), { pago: false });

      const deltaCall = tx.update.mock.calls[1][1];
      expect(deltaCall).toEqual({ totalRecaudado: { __increment: -50000 } });
    });
  });

  describe('deleteParticipante', () => {
    it('decrements counters by old monto when paid', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.deleteParticipante('t1', {
        id: 'p1',
        nombreCompleto: 'Ana',
        whatsapp: '',
        email: '',
        ciudadOrigen: '',
        comoNosConocio: '',
        pago: true,
        montoPagado: 50000,
        notas: '',
        creadoEn: new Date(),
      });

      expect(tx.delete).toHaveBeenCalled();
      const counterUpdate = tx.update.mock.calls[0][1];
      expect(counterUpdate).toEqual({
        participantesCount: { __increment: -1 },
        totalRecaudado:     { __increment: -50000 },
      });
    });

    it('decrements only the count when participante never paid', async () => {
      const tx = makeFakeTx();
      mockRunTransaction.mockImplementation(async (_db, fn) => fn(tx));

      await service.deleteParticipante('t1', {
        id: 'p1',
        nombreCompleto: 'Ana',
        whatsapp: '',
        email: '',
        ciudadOrigen: '',
        comoNosConocio: '',
        pago: false,
        montoPagado: null,
        notas: '',
        creadoEn: new Date(),
      });

      const counterUpdate = tx.update.mock.calls[0][1];
      // Treat -0 and 0 as equivalent here — both mean "no money to subtract"
      expect(counterUpdate.totalRecaudado.__increment === 0).toBe(true);
    });
  });
});
