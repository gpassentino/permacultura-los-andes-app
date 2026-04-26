import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, ParamMap } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { BehaviorSubject } from 'rxjs';

import { ContactoDetalleComponent } from './contacto-detalle.component';
import { ContactoService } from '../../../services/contacto.service';
import { Contacto } from '../../../shared/models/contacto.model';

registerLocaleData(localeEsCO);

function makeContacto(overrides: Partial<Contacto> = {}): Contacto {
  return {
    id: 'c1',
    phone: '3001234567',
    name: 'Juan',
    whatsappLabel: 'LD | Paisajismo',
    businessTypes: ['paisajismo'],
    status: 'lead',
    location: {},
    notas: '',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    lastSyncAt: new Date(),
    ...overrides,
  };
}

describe('ContactoDetalleComponent', () => {
  let contactoSubject: BehaviorSubject<Contacto | undefined>;
  let messagesSubject: BehaviorSubject<unknown[]>;
  let paramMapSubject: BehaviorSubject<ParamMap>;
  let mockService: {
    getContacto: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    updateContacto: ReturnType<typeof vi.fn>;
    deleteContacto: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    contactoSubject = new BehaviorSubject<Contacto | undefined>(makeContacto());
    messagesSubject = new BehaviorSubject<unknown[]>([]);
    paramMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ id: 'c1' }));
    mockService = {
      getContacto: vi.fn().mockReturnValue(contactoSubject),
      getMessages: vi.fn().mockReturnValue(messagesSubject),
      updateContacto: vi.fn().mockResolvedValue(undefined),
      deleteContacto: vi.fn().mockResolvedValue(undefined),
    };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ContactoDetalleComponent],
      providers: [
        { provide: ContactoService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { paramMap: paramMapSubject } },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    }).compileComponents();
  });

  function createComponent(): ContactoDetalleComponent {
    const fixture = TestBed.createComponent(ContactoDetalleComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('loading', () => {
    it('is false once contact arrives', () => {
      const c = createComponent();
      expect(c.loading()).toBe(false);
      expect(c.contacto()?.name).toBe('Juan');
    });
  });

  describe('tab switching', () => {
    it('starts on info tab', () => {
      const c = createComponent();
      expect(c.activeTab()).toBe('info');
    });

    it('switches to mensajes tab', () => {
      const c = createComponent();
      c.activeTab.set('mensajes');
      expect(c.activeTab()).toBe('mensajes');
    });

    it('switches to academia tab', () => {
      const c = createComponent();
      c.activeTab.set('academia');
      expect(c.activeTab()).toBe('academia');
    });
  });

  describe('edit modal', () => {
    it('opens', () => {
      const c = createComponent();
      c.openEditModal();
      expect(c.showEditModal()).toBe(true);
    });

    it('closes', () => {
      const c = createComponent();
      c.openEditModal();
      c.closeEditModal();
      expect(c.showEditModal()).toBe(false);
    });

    it('onBackdropClick closes only when clicking the modal element itself', () => {
      const c = createComponent();
      c.openEditModal();

      const backdropEl = document.createElement('div');
      backdropEl.classList.add('modal');
      c.onBackdropClick({ target: backdropEl } as unknown as MouseEvent);
      expect(c.showEditModal()).toBe(false);

      c.openEditModal();
      const innerEl = document.createElement('div');
      c.onBackdropClick({ target: innerEl } as unknown as MouseEvent);
      expect(c.showEditModal()).toBe(true);
    });
  });

  describe('navigation', () => {
    it('goBack navigates to /contactos', () => {
      const c = createComponent();
      c.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/contactos']);
    });
  });

  describe('onGuardar', () => {
    it('calls updateContacto when id present and closes modal', async () => {
      const c = createComponent();
      c.openEditModal();
      await c.onGuardar({ data: { name: 'Updated' }, id: 'c1' });
      expect(mockService.updateContacto).toHaveBeenCalledWith('c1', { name: 'Updated' });
      expect(c.showEditModal()).toBe(false);
    });

    it('does nothing service-wise when id is missing but still closes modal', async () => {
      const c = createComponent();
      c.openEditModal();
      await c.onGuardar({ data: { name: 'X' } });
      expect(mockService.updateContacto).not.toHaveBeenCalled();
      expect(c.showEditModal()).toBe(false);
    });

    it('sets error on failure', async () => {
      mockService.updateContacto.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onGuardar({ data: { name: 'X' }, id: 'c1' });
      expect(c.error()).toBe('Error al guardar. Intente de nuevo.');
    });
  });

  describe('onEliminar', () => {
    it('calls deleteContacto and navigates back', async () => {
      const c = createComponent();
      await c.onEliminar('c1');
      expect(mockService.deleteContacto).toHaveBeenCalledWith('c1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/contactos']);
    });

    it('sets error on failure', async () => {
      mockService.deleteContacto.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onEliminar('c1');
      expect(c.error()).toBe('Error al eliminar. Intente de nuevo.');
    });
  });

  describe('display helpers', () => {
    it('whatsappHref strips non-digits', () => {
      const c = createComponent();
      expect(c.whatsappHref('+57 300-123 4567')).toBe('https://wa.me/573001234567');
    });

    it('telHref preserves the original phone', () => {
      const c = createComponent();
      expect(c.telHref('+57300')).toBe('tel:+57300');
    });

    it('mapsHref uses coordinates when present', () => {
      const c = createComponent();
      const result = c.mapsHref(makeContacto({
        location: { coordinates: { lat: 6.2, lng: -75.6 } },
      }));
      expect(result).toBe('https://maps.google.com/?q=6.2,-75.6');
    });

    it('mapsHref falls back to address+city', () => {
      const c = createComponent();
      const result = c.mapsHref(makeContacto({
        location: { city: 'El Retiro', address: 'Vereda X' },
      }));
      expect(result).toContain('Vereda%20X');
      expect(result).toContain('El%20Retiro');
    });

    it('hasLocation returns true when any field is set', () => {
      const c = createComponent();
      expect(c.hasLocation(makeContacto({ location: {} }))).toBe(false);
      expect(c.hasLocation(makeContacto({ location: { city: 'X' } }))).toBe(true);
      expect(c.hasLocation(makeContacto({ location: { address: 'Y' } }))).toBe(true);
      expect(c.hasLocation(makeContacto({
        location: { coordinates: { lat: 1, lng: 2 } },
      }))).toBe(true);
    });

    it('scheduleLabel maps known values', () => {
      const c = createComponent();
      expect(c.scheduleLabel('weekday')).toBe('Días de semana');
      expect(c.scheduleLabel('weekend')).toBe('Fines de semana');
      expect(c.scheduleLabel('evening')).toBe('Noches');
    });

    it('scheduleLabel returns dash when undefined', () => {
      const c = createComponent();
      expect(c.scheduleLabel(undefined)).toBe('—');
    });

    it('statusLabel falls back to raw status when missing in map', () => {
      const c = createComponent();
      expect(c.statusLabel('lead')).toBe('Lead');
    });

    it('typeLabel and typeIcon use the lookup maps', () => {
      const c = createComponent();
      expect(c.typeLabel('paisajismo')).toBe('Paisajismo');
      expect(c.typeIcon('academia')).toBe('🎓');
    });
  });
});
