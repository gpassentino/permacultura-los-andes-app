import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

import { ContactoFormComponent } from './contacto-form.component';
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
    location: { city: 'El Retiro', address: 'Vereda X' },
    notas: 'Notas',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    lastSyncAt: new Date(),
    ...overrides,
  };
}

@Component({
  imports: [ContactoFormComponent],
  template: `<app-contacto-form
    [contacto]="contacto()"
    (cerrar)="cerrado = true"
    (guardar)="guardado = $event"
    (eliminar)="eliminado = $event"
  />`,
})
class TestHost {
  contacto = signal<Contacto | null>(null);
  cerrado = false;
  guardado: { data: Partial<Contacto>; id?: string } | null = null;
  eliminado: string | null = null;
}

describe('ContactoFormComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  function getComponent(): ContactoFormComponent {
    return fixture.debugElement.children[0].componentInstance as ContactoFormComponent;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
  });

  describe('new contact mode', () => {
    beforeEach(() => fixture.detectChanges());

    it('starts with empty form and no selected types', () => {
      const c = getComponent();
      expect(c.form.get('name')?.value).toBe('');
      expect(c.selectedTypes().size).toBe(0);
    });

    it('does not emit guardar when name and phone are missing', async () => {
      const c = getComponent();
      await c.onSubmit();
      expect(host.guardado).toBeNull();
    });

    it('does not emit guardar when phone is invalid', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'Test', phone: 'abc' });
      await c.onSubmit();
      expect(host.guardado).toBeNull();
    });

    it('emits guardar with data when valid', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567' });
      await c.onSubmit();
      expect(host.guardado).toBeTruthy();
      expect(host.guardado!.id).toBeUndefined();
      expect(host.guardado!.data.name).toBe('New');
      // No selected types defaults to ['general']
      expect(host.guardado!.data.businessTypes).toEqual(['general']);
    });

    it('omits empty location fields from emit', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567' });
      await c.onSubmit();
      expect(host.guardado!.data.location).toEqual({});
    });

    it('includes location.city when set', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567', city: 'El Retiro' });
      await c.onSubmit();
      expect(host.guardado!.data.location).toEqual({ city: 'El Retiro' });
    });

    it('omits preferredSchedule when blank', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567' });
      await c.onSubmit();
      expect(host.guardado!.data.academiaHistory?.preferredSchedule).toBeUndefined();
    });

    it('includes preferredSchedule when set', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567', preferredSchedule: 'weekend' });
      await c.onSubmit();
      expect(host.guardado!.data.academiaHistory?.preferredSchedule).toBe('weekend');
    });

    it('initializes empty academiaHistory arrays for new contacts', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'New', phone: '3001234567' });
      await c.onSubmit();
      expect(host.guardado!.data.academiaHistory?.completedTalleres).toEqual([]);
      expect(host.guardado!.data.academiaHistory?.interestedTalleres).toEqual([]);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      host.contacto.set(makeContacto());
      fixture.detectChanges();
    });

    it('pre-populates form fields', () => {
      const c = getComponent();
      expect(c.form.get('name')?.value).toBe('Juan');
      expect(c.form.get('city')?.value).toBe('El Retiro');
      expect(c.form.get('address')?.value).toBe('Vereda X');
      expect(c.form.get('whatsappLabel')?.value).toBe('LD | Paisajismo');
    });

    it('pre-populates selectedTypes from businessTypes', () => {
      const c = getComponent();
      expect(c.selectedTypes().has('paisajismo')).toBe(true);
    });

    it('emits guardar with id when submitting', async () => {
      const c = getComponent();
      await c.onSubmit();
      expect(host.guardado!.id).toBe('c1');
    });

    it('uses selected types from contact, not "general" default', async () => {
      const c = getComponent();
      await c.onSubmit();
      expect(host.guardado!.data.businessTypes).toEqual(['paisajismo']);
    });

    it('preserves existing academiaHistory arrays', async () => {
      host.contacto.set(makeContacto({
        academiaHistory: {
          completedTalleres: ['t1', 't2'],
          interestedTalleres: ['t3'],
        },
      }));
      fixture.detectChanges();
      const c = getComponent();
      await c.onSubmit();
      expect(host.guardado!.data.academiaHistory?.completedTalleres).toEqual(['t1', 't2']);
      expect(host.guardado!.data.academiaHistory?.interestedTalleres).toEqual(['t3']);
    });
  });

  describe('toggleType', () => {
    beforeEach(() => fixture.detectChanges());

    it('adds a type if not selected', () => {
      const c = getComponent();
      c.toggleType('paisajismo');
      expect(c.selectedTypes().has('paisajismo')).toBe(true);
    });

    it('removes a type if already selected', () => {
      const c = getComponent();
      c.toggleType('paisajismo');
      c.toggleType('paisajismo');
      expect(c.selectedTypes().has('paisajismo')).toBe(false);
    });

    it('isTypeSelected reflects state', () => {
      const c = getComponent();
      expect(c.isTypeSelected('paisajismo')).toBe(false);
      c.toggleType('paisajismo');
      expect(c.isTypeSelected('paisajismo')).toBe(true);
    });
  });

  describe('delete confirmation', () => {
    beforeEach(() => {
      host.contacto.set(makeContacto());
      fixture.detectChanges();
    });

    it('onEliminar sets confirmDelete to true', () => {
      const c = getComponent();
      c.onEliminar();
      expect(c.confirmDelete()).toBe(true);
    });

    it('onConfirmEliminar emits id when contact present', () => {
      const c = getComponent();
      c.onConfirmEliminar();
      expect(host.eliminado).toBe('c1');
    });

    it('onConfirmEliminar does nothing when no contact', () => {
      host.contacto.set(null);
      fixture.detectChanges();
      const c = getComponent();
      c.onConfirmEliminar();
      expect(host.eliminado).toBeNull();
    });
  });

  describe('saving guard', () => {
    beforeEach(() => fixture.detectChanges());

    it('skips submission while saving is true', async () => {
      const c = getComponent();
      c.form.patchValue({ name: 'X', phone: '3001234567' });
      c.saving.set(true);
      await c.onSubmit();
      expect(host.guardado).toBeNull();
    });
  });
});
