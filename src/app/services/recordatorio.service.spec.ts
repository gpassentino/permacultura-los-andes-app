import { TestBed } from '@angular/core/testing';
import { RecordatorioService } from './recordatorio.service';
import { Cliente } from '../shared/models/cliente.model';

function makeCliente(recordatorioFecha: Date | null): Cliente {
  return {
    id: '1',
    nombre: 'Test',
    tipoProyecto: '',
    municipio: '',
    whatsapp: '',
    fechaUltimoContacto: null,
    fechaEstimadaInicio: null,
    notas: '',
    documentos: [],
    recordatorioFecha,
    recordatorioMensaje: '',
    estado: 'Contacto Inicial',
    creadoEn: new Date(),
    creadoPor: '',
    actualizadoEn: new Date(),
  };
}

describe('RecordatorioService', () => {
  let service: RecordatorioService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecordatorioService);
  });

  describe('getEstado', () => {
    it('returns null when recordatorioFecha is null', () => {
      expect(service.getEstado(makeCliente(null))).toBeNull();
    });

    it('returns "vencido" for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.getEstado(makeCliente(yesterday))).toBe('vencido');
    });

    it('returns "hoy" for a date later today', () => {
      const laterToday = new Date();
      laterToday.setHours(23, 0, 0, 0);
      expect(service.getEstado(makeCliente(laterToday))).toBe('hoy');
    });

    it('returns "pronto" for a date tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      expect(service.getEstado(makeCliente(tomorrow))).toBe('pronto');
    });

    it('returns null for dates more than 1 day out', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      expect(service.getEstado(makeCliente(nextWeek))).toBeNull();
    });
  });

  describe('esBanner', () => {
    it('is true for vencido/hoy/pronto', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.esBanner(makeCliente(yesterday))).toBe(true);
    });

    it('is false when no reminder', () => {
      expect(service.esBanner(makeCliente(null))).toBe(false);
    });

    it('is false for far-future reminder', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      expect(service.esBanner(makeCliente(nextWeek))).toBe(false);
    });
  });

  describe('esBadge', () => {
    it('is true when reminder has any state', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.esBadge(makeCliente(yesterday))).toBe(true);
    });

    it('is false when no reminder', () => {
      expect(service.esBadge(makeCliente(null))).toBe(false);
    });
  });

  describe('getClientesBanner', () => {
    it('filters list to only banner-eligible clients', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const result = service.getClientesBanner([
        makeCliente(yesterday),
        makeCliente(null),
        makeCliente(nextWeek),
      ]);

      expect(result.length).toBe(1);
    });
  });

  describe('badgeClass', () => {
    it('returns bg-danger for vencido', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.badgeClass(makeCliente(yesterday))).toBe('bg-danger');
    });

    it('returns bg-warning for hoy', () => {
      const laterToday = new Date();
      laterToday.setHours(23, 0, 0, 0);
      expect(service.badgeClass(makeCliente(laterToday))).toBe('bg-warning text-dark');
    });

    it('returns bg-warning for pronto', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(service.badgeClass(makeCliente(tomorrow))).toBe('bg-warning text-dark');
    });

    it('returns empty string when no reminder', () => {
      expect(service.badgeClass(makeCliente(null))).toBe('');
    });
  });

  describe('bannerLabel', () => {
    it('returns "Vencido" for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.bannerLabel(makeCliente(yesterday))).toBe('Vencido');
    });

    it('returns "Hoy" for today', () => {
      const laterToday = new Date();
      laterToday.setHours(23, 0, 0, 0);
      expect(service.bannerLabel(makeCliente(laterToday))).toBe('Hoy');
    });

    it('returns "Mañana" for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(service.bannerLabel(makeCliente(tomorrow))).toBe('Mañana');
    });

    it('returns empty string when no reminder', () => {
      expect(service.bannerLabel(makeCliente(null))).toBe('');
    });
  });
});
