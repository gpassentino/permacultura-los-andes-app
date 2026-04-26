import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { BehaviorSubject } from 'rxjs';

import { ContactosComponent } from './contactos.component';
import { ContactoService } from '../../services/contacto.service';
import { Contacto } from '../../shared/models/contacto.model';

registerLocaleData(localeEsCO);

function makeContacto(overrides: Partial<Contacto> = {}): Contacto {
  return {
    id: '1',
    phone: '3001234567',
    name: 'Juan Pérez',
    whatsappLabel: 'NM',
    businessTypes: [],
    status: 'nuevo_mensaje',
    location: {},
    notas: '',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    lastSyncAt: new Date(),
    ...overrides,
  };
}

describe('ContactosComponent', () => {
  let contactosSubject: BehaviorSubject<Contacto[]>;
  let mockContactoService: {
    getContactos: ReturnType<typeof vi.fn>;
    addContacto: ReturnType<typeof vi.fn>;
    updateContacto: ReturnType<typeof vi.fn>;
    deleteContacto: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    contactosSubject = new BehaviorSubject<Contacto[]>([]);
    mockContactoService = {
      getContactos: vi.fn().mockReturnValue(contactosSubject),
      addContacto: vi.fn().mockResolvedValue('new-id'),
      updateContacto: vi.fn().mockResolvedValue(undefined),
      deleteContacto: vi.fn().mockResolvedValue(undefined),
    };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ContactosComponent],
      providers: [
        { provide: ContactoService, useValue: mockContactoService },
        { provide: Router, useValue: mockRouter },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    }).compileComponents();
  });

  function createComponent(): ContactosComponent {
    const fixture = TestBed.createComponent(ContactosComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('loading', () => {
    it('is false once data arrives', () => {
      contactosSubject.next([]);
      const c = createComponent();
      expect(c.loading()).toBe(false);
    });
  });

  describe('quickFilter', () => {
    it('"leads" includes both lead and interesado', () => {
      contactosSubject.next([
        makeContacto({ id: '1', status: 'lead' }),
        makeContacto({ id: '2', status: 'interesado' }),
        makeContacto({ id: '3', status: 'cliente' }),
      ]);
      const c = createComponent();
      c.quickFilter.set('leads');
      expect(c.filtered().length).toBe(2);
    });

    it('"clientes" only includes cliente', () => {
      contactosSubject.next([
        makeContacto({ id: '1', status: 'lead' }),
        makeContacto({ id: '2', status: 'cliente' }),
      ]);
      const c = createComponent();
      c.quickFilter.set('clientes');
      expect(c.filtered().length).toBe(1);
    });

    it('"paisajismo" filters by businessTypes', () => {
      contactosSubject.next([
        makeContacto({ id: '1', businessTypes: ['paisajismo'] }),
        makeContacto({ id: '2', businessTypes: ['academia'] }),
        makeContacto({ id: '3', businessTypes: ['paisajismo', 'academia'] }),
      ]);
      const c = createComponent();
      c.quickFilter.set('paisajismo');
      expect(c.filtered().length).toBe(2);
    });

    it('"todos" returns all', () => {
      contactosSubject.next([
        makeContacto({ id: '1' }),
        makeContacto({ id: '2', status: 'cliente' }),
      ]);
      const c = createComponent();
      c.quickFilter.set('todos');
      expect(c.filtered().length).toBe(2);
    });
  });

  describe('search', () => {
    it('matches by name (case-insensitive)', () => {
      contactosSubject.next([
        makeContacto({ id: '1', name: 'Juan' }),
        makeContacto({ id: '2', name: 'María' }),
      ]);
      const c = createComponent();
      c.searchQuery.set('jUaN');
      expect(c.filtered().length).toBe(1);
      expect(c.filtered()[0].name).toBe('Juan');
    });

    it('matches by phone', () => {
      contactosSubject.next([
        makeContacto({ id: '1', phone: '3001234567' }),
        makeContacto({ id: '2', phone: '3009999999' }),
      ]);
      const c = createComponent();
      c.searchQuery.set('123');
      expect(c.filtered().length).toBe(1);
    });

    it('matches by city', () => {
      contactosSubject.next([
        makeContacto({ id: '1', location: { city: 'El Retiro' } }),
        makeContacto({ id: '2', location: { city: 'Medellín' } }),
      ]);
      const c = createComponent();
      c.searchQuery.set('retiro');
      expect(c.filtered().length).toBe(1);
    });

    it('returns no results when nothing matches', () => {
      contactosSubject.next([makeContacto({ name: 'Juan' })]);
      const c = createComponent();
      c.searchQuery.set('zzz');
      expect(c.filtered().length).toBe(0);
    });
  });

  describe('statusFilter', () => {
    it('narrows to a specific status', () => {
      contactosSubject.next([
        makeContacto({ id: '1', status: 'lead' }),
        makeContacto({ id: '2', status: 'cliente' }),
      ]);
      const c = createComponent();
      c.statusFilter.set('lead');
      expect(c.filtered().length).toBe(1);
    });

    it('combines with quickFilter', () => {
      contactosSubject.next([
        makeContacto({ id: '1', status: 'lead', businessTypes: ['paisajismo'] }),
        makeContacto({ id: '2', status: 'lead', businessTypes: ['academia'] }),
      ]);
      const c = createComponent();
      c.quickFilter.set('paisajismo');
      c.statusFilter.set('lead');
      expect(c.filtered().length).toBe(1);
    });
  });

  describe('stats', () => {
    it('counts totals correctly', () => {
      contactosSubject.next([
        makeContacto({ id: '1', status: 'nuevo_mensaje' }),
        makeContacto({ id: '2', status: 'lead' }),
        makeContacto({ id: '3', status: 'lead' }),
        makeContacto({ id: '4', status: 'cliente' }),
      ]);
      const c = createComponent();
      expect(c.totalContactos()).toBe(4);
      expect(c.totalNuevos()).toBe(1);
      expect(c.totalLeads()).toBe(2);
      expect(c.totalClientes()).toBe(1);
    });
  });

  describe('modal', () => {
    it('openNuevoContacto opens with no contact selected', () => {
      const c = createComponent();
      c.openNuevoContacto();
      expect(c.showModal()).toBe(true);
      expect(c.selectedContact()).toBeNull();
    });

    it('openEditarContacto sets selected contact and stops propagation', () => {
      const c = createComponent();
      const stop = vi.fn();
      const fakeEvent = { stopPropagation: stop } as unknown as MouseEvent;
      const contact = makeContacto();
      c.openEditarContacto(contact, fakeEvent);
      expect(stop).toHaveBeenCalled();
      expect(c.showModal()).toBe(true);
      expect(c.selectedContact()).toBe(contact);
    });

    it('closeModal resets state', () => {
      const c = createComponent();
      c.openEditarContacto(makeContacto(), { stopPropagation: () => {} } as MouseEvent);
      c.closeModal();
      expect(c.showModal()).toBe(false);
      expect(c.selectedContact()).toBeNull();
    });
  });

  describe('onGuardar', () => {
    it('calls addContacto when no id', async () => {
      const c = createComponent();
      await c.onGuardar({ data: { name: 'New' } });
      expect(mockContactoService.addContacto).toHaveBeenCalledWith({ name: 'New' });
    });

    it('calls updateContacto when id present', async () => {
      const c = createComponent();
      await c.onGuardar({ data: { name: 'Updated' }, id: '1' });
      expect(mockContactoService.updateContacto).toHaveBeenCalledWith('1', { name: 'Updated' });
    });

    it('sets error on failure', async () => {
      mockContactoService.addContacto.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onGuardar({ data: { name: 'X' } });
      expect(c.error()).toBe('Error al guardar el contacto. Intente de nuevo.');
    });
  });

  describe('onEliminar', () => {
    it('calls deleteContacto', async () => {
      const c = createComponent();
      await c.onEliminar('1');
      expect(mockContactoService.deleteContacto).toHaveBeenCalledWith('1');
    });

    it('sets error on failure', async () => {
      mockContactoService.deleteContacto.mockRejectedValue(new Error('fail'));
      const c = createComponent();
      await c.onEliminar('1');
      expect(c.error()).toBe('Error al eliminar el contacto. Intente de nuevo.');
    });
  });

  describe('navigation', () => {
    it('goToDetalle navigates by id', () => {
      const c = createComponent();
      c.goToDetalle(makeContacto({ id: 'abc' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/contactos', 'abc']);
    });
  });

  describe('display helpers', () => {
    it('whatsappHref strips non-digits', () => {
      const c = createComponent();
      expect(c.whatsappHref('+57 300 123 4567')).toBe('https://wa.me/573001234567');
    });

    it('telHref preserves the original phone', () => {
      const c = createComponent();
      expect(c.telHref('+57 300')).toBe('tel:+57 300');
    });

    it('businessTypeIcons returns space-separated icons', () => {
      const c = createComponent();
      const result = c.businessTypeIcons(['paisajismo', 'academia']);
      expect(result).toBe('🌿 🎓');
    });
  });
});
