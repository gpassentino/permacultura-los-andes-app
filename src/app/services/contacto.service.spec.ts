import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { ContactoService } from './contacto.service';
import { Contacto, WhatsAppMessage } from '../shared/models/contacto.model';

const {
  mockCollectionData, mockDocData, mockAddDoc, mockUpdateDoc, mockDeleteDoc,
  mockDoc, mockCollection, mockQuery, mockOrderBy, mockServerTimestamp,
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
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) }) },
}));

vi.mock('@angular/fire/auth', () => ({
  Auth: class {},
}));

describe('ContactoService', () => {
  let service: ContactoService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('contacts-col');
    mockQuery.mockReturnValue('contacts-query');
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
    service = TestBed.inject(ContactoService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('getContactos', () => {
    it('maps Firestore docs to Contactos with Date objects', () => {
      const now = new Date();
      const data = new BehaviorSubject([
        {
          id: '1',
          phone: '3001234567',
          name: 'Juan',
          whatsappLabel: 'LD | Paisajismo',
          businessTypes: ['paisajismo'],
          status: 'lead',
          location: { city: 'El Retiro' },
          notas: 'Note',
          createdAt:     { toDate: () => now },
          lastMessageAt: { toDate: () => now },
          lastSyncAt:    { toDate: () => now },
        },
      ]);
      mockCollectionData.mockReturnValue(data);

      const out: Contacto[] = [];
      service.getContactos().subscribe(c => out.push(...c));

      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('Juan');
      expect(out[0].createdAt).toBeInstanceOf(Date);
      expect(out[0].businessTypes).toEqual(['paisajismo']);
    });

    it('applies safe defaults for missing fields', () => {
      const data = new BehaviorSubject([
        {
          id: '2',
          phone: '',
          name: '',
          // most fields missing
          createdAt: null,
          lastMessageAt: null,
          lastSyncAt: null,
        },
      ]);
      mockCollectionData.mockReturnValue(data);

      const out: Contacto[] = [];
      service.getContactos().subscribe(c => out.push(...c));

      expect(out[0].whatsappLabel).toBe('NM');
      expect(out[0].status).toBe('nuevo_mensaje');
      expect(out[0].businessTypes).toEqual([]);
      expect(out[0].location).toEqual({});
      expect(out[0].createdAt).toBeInstanceOf(Date);
      expect(out[0].notas).toBe('');
    });
  });

  describe('getContacto', () => {
    it('returns mapped Contacto when doc exists', () => {
      const now = new Date();
      const data = new BehaviorSubject({
        id: '1',
        phone: '300',
        name: 'Maria',
        createdAt: { toDate: () => now },
        lastMessageAt: { toDate: () => now },
        lastSyncAt: { toDate: () => now },
      });
      mockDocData.mockReturnValue(data);

      let result: Contacto | undefined;
      service.getContacto('1').subscribe(c => { result = c; });

      expect(result?.name).toBe('Maria');
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it('returns undefined when doc does not exist', () => {
      const data = new BehaviorSubject(undefined);
      mockDocData.mockReturnValue(data);

      let result: Contacto | undefined = undefined as Contacto | undefined;
      let called = false;
      service.getContacto('missing').subscribe(c => { result = c; called = true; });

      expect(called).toBe(true);
      expect(result).toBeUndefined();
    });
  });

  describe('addContacto', () => {
    it('calls addDoc with server timestamps and returns new id', async () => {
      const id = await service.addContacto({ name: 'Nuevo', phone: '300' });
      expect(mockAddDoc).toHaveBeenCalled();
      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload).toMatchObject({
        name: 'Nuevo',
        phone: '300',
        createdAt: 'SERVER_TS',
        lastMessageAt: 'SERVER_TS',
        lastSyncAt: 'SERVER_TS',
      });
      expect(id).toBe('new-id');
    });

    it('strips id/createdAt/lastMessageAt/lastSyncAt from incoming data', async () => {
      await service.addContacto({
        name: 'X',
        id: 'should-be-stripped',
        createdAt: new Date(),
        lastMessageAt: new Date(),
        lastSyncAt: new Date(),
      } as Partial<Contacto>);
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['id']).toBeUndefined();
      // server timestamps used, not the Date instances we passed
      expect(payload['createdAt']).toBe('SERVER_TS');
    });

    it('converts Date fields to Firestore Timestamps via toFirestore', async () => {
      const ts = new Date(2026, 0, 1);
      await service.addContacto({ name: 'X', someDate: ts } as unknown as Partial<Contacto>);
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, { toDate(): Date }>;
      expect(payload['someDate'].toDate()).toEqual(ts);
    });
  });

  describe('updateContacto', () => {
    it('calls updateDoc with lastSyncAt server timestamp', async () => {
      await service.updateContacto('id-1', { name: 'Updated' });
      expect(mockUpdateDoc).toHaveBeenCalled();
      const payload = mockUpdateDoc.mock.calls[0][1];
      expect(payload).toMatchObject({ name: 'Updated', lastSyncAt: 'SERVER_TS' });
    });
  });

  describe('deleteContacto', () => {
    it('calls deleteDoc', async () => {
      await service.deleteContacto('id-1');
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('maps Firestore messages to WhatsAppMessage with Date timestamp', () => {
      const now = new Date();
      const data = new BehaviorSubject([
        {
          id: 'm1',
          text: 'Hola',
          timestamp: { toDate: () => now },
          fromContact: true,
          messageType: 'text',
        },
      ]);
      mockCollectionData.mockReturnValue(data);

      const out: WhatsAppMessage[] = [];
      service.getMessages('contact-1').subscribe(m => out.push(...m));

      expect(out[0].text).toBe('Hola');
      expect(out[0].timestamp).toBeInstanceOf(Date);
      expect(out[0].fromContact).toBe(true);
    });

    it('applies defaults when fields missing', () => {
      const data = new BehaviorSubject([
        { id: 'm2', text: '', timestamp: null, fromContact: undefined, messageType: undefined },
      ]);
      mockCollectionData.mockReturnValue(data);

      const out: WhatsAppMessage[] = [];
      service.getMessages('contact-1').subscribe(m => out.push(...m));

      expect(out[0].fromContact).toBe(true);
      expect(out[0].messageType).toBe('text');
      expect(out[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('addMessage', () => {
    it('adds message and updates parent lastMessageAt', async () => {
      await service.addMessage('contact-1', { text: 'Hi', fromContact: false });
      expect(mockAddDoc).toHaveBeenCalled();
      const msgPayload = mockAddDoc.mock.calls[0][1];
      expect(msgPayload).toMatchObject({
        text: 'Hi',
        fromContact: false,
        messageType: 'text',
        mediaUrl: null,
        timestamp: 'SERVER_TS',
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
      const parentPayload = mockUpdateDoc.mock.calls[0][1];
      expect(parentPayload).toMatchObject({ lastMessageAt: 'SERVER_TS' });
    });

    it('uses defaults when message fields are missing', async () => {
      await service.addMessage('contact-1', {});
      const msgPayload = mockAddDoc.mock.calls[0][1];
      expect(msgPayload).toMatchObject({
        text: '',
        fromContact: false,
        messageType: 'text',
        mediaUrl: null,
      });
    });
  });
});
