import { TestBed } from '@angular/core/testing';
import { WhatsAppSyncService } from './whatsapp-sync.service';
import { ContactoService } from './contacto.service';

describe('WhatsAppSyncService', () => {
  let service: WhatsAppSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ContactoService, useValue: {} },
      ],
    });
    service = TestBed.inject(WhatsAppSyncService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('labelToStatus', () => {
    it('maps NM prefixes to nuevo_mensaje', () => {
      expect(service.labelToStatus('NM')).toBe('nuevo_mensaje');
      expect(service.labelToStatus('NM | Paisajismo')).toBe('nuevo_mensaje');
      expect(service.labelToStatus('NM | Academia')).toBe('nuevo_mensaje');
    });

    it('maps IN prefixes to interesado', () => {
      expect(service.labelToStatus('IN')).toBe('interesado');
      expect(service.labelToStatus('IN | Paisajismo')).toBe('interesado');
      expect(service.labelToStatus('IN | Academia')).toBe('interesado');
    });

    it('maps LD prefixes to lead', () => {
      expect(service.labelToStatus('LD')).toBe('lead');
      expect(service.labelToStatus('LD | Paisajismo')).toBe('lead');
      expect(service.labelToStatus('LD | Academia')).toBe('lead');
    });

    it('maps CL prefixes to cliente', () => {
      expect(service.labelToStatus('CL')).toBe('cliente');
      expect(service.labelToStatus('CL | Paisajismo')).toBe('cliente');
      expect(service.labelToStatus('CL | Academia')).toBe('cliente');
    });

    it('maps SR prefixes to sin_respuesta', () => {
      expect(service.labelToStatus('SR')).toBe('sin_respuesta');
      expect(service.labelToStatus('SR | Paisajismo')).toBe('sin_respuesta');
      expect(service.labelToStatus('SR | Academia')).toBe('sin_respuesta');
    });

    it('falls back to nuevo_mensaje for unrecognized labels', () => {
      expect(service.labelToStatus('Proveedor')).toBe('nuevo_mensaje');
    });
  });

  describe('Phase 2 stubs (resolve without throwing)', () => {
    it('processWebhookPayload resolves', async () => {
      await expect(service.processWebhookPayload({})).resolves.toBeUndefined();
    });

    it('syncContact resolves', async () => {
      await expect(service.syncContact('wa1', 'Juan', '300')).resolves.toBeUndefined();
    });

    it('syncIncomingMessage resolves', async () => {
      await expect(service.syncIncomingMessage('300', 'Hola', new Date())).resolves.toBeUndefined();
    });

    it('syncLabelChange resolves', async () => {
      await expect(service.syncLabelChange('300', 'LD | Paisajismo')).resolves.toBeUndefined();
    });

    it('syncLocationMessage resolves', async () => {
      await expect(service.syncLocationMessage('300', 6.0, -75.0)).resolves.toBeUndefined();
    });
  });
});
