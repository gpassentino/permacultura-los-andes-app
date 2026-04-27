import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { ClienteModalComponent } from './cliente-modal.component';
import { Cliente } from '../../../shared/models/cliente.model';

registerLocaleData(localeEsCO);

function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: 'c1',
    nombre: 'Existing Client',
    categoria: 'Visita Técnica',
    checklist: [],
    municipio: 'El Retiro',
    whatsapp: '3001234567',
    fechaUltimoContacto: new Date(2026, 3, 1),
    fechaEstimadaInicio: null,
    notas: 'Some notes',
    documentos: [{ label: 'Propuesta', url: 'https://drive.google.com/doc1' }],
    recordatorioFecha: null,
    recordatorioMensaje: '',
    estado: 'Antes',
    creadoEn: new Date(),
    creadoPor: 'test@test.com',
    actualizadoEn: new Date(),
    ...overrides,
  };
}

@Component({
  imports: [ClienteModalComponent],
  template: `<app-cliente-modal
    [cliente]="cliente()"
    (cerrar)="cerrado = true"
    (guardar)="guardado = $event"
    (eliminar)="eliminado = $event"
  />`,
})
class TestHostComponent {
  cliente = signal<Cliente | null>(null);
  cerrado = false;
  guardado: any = null;
  eliminado: string | null = null;
}

describe('ClienteModalComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  describe('new client mode', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should create with empty form', () => {
      const title = fixture.nativeElement.querySelector('.modal-title');
      expect(title.textContent).toContain('Nuevo Cliente');
    });

    it('should not emit guardar when form is invalid (no nombre)', () => {
      const form = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(host.guardado).toBeNull();
    });

    it('should emit guardar with data when form is valid', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      component.form.patchValue({ nombre: 'New Client' });
      component.onSubmit();
      expect(host.guardado).toBeTruthy();
      expect(host.guardado.data.nombre).toBe('New Client');
      expect(host.guardado.id).toBeUndefined();
    });

    it('should not show delete button for new client', () => {
      const deleteBtn = fixture.nativeElement.querySelector('.btn-outline-danger');
      expect(deleteBtn).toBeNull();
    });
  });

  describe('edit client mode', () => {
    beforeEach(() => {
      host.cliente.set(makeCliente());
      fixture.detectChanges();
    });

    it('should show edit title', () => {
      const title = fixture.nativeElement.querySelector('.modal-title');
      expect(title.textContent).toContain('Editar Cliente');
    });

    it('should pre-populate form from existing client', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      expect(component.form.get('nombre')?.value).toBe('Existing Client');
      expect(component.form.get('municipio')?.value).toBe('El Retiro');
    });

    it('should populate documentos form array', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      expect(component.documentosArray.length).toBe(1);
    });

    it('should emit guardar with id when editing', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      component.onSubmit();
      expect(host.guardado.id).toBe('c1');
    });

    it('should show delete button', () => {
      const deleteBtn = fixture.nativeElement.querySelector('.btn-outline-danger');
      expect(deleteBtn).toBeTruthy();
    });

    it('should show confirmation on delete click', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      component.onEliminar();
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('.alert-danger');
      expect(alert).toBeTruthy();
    });

    it('should emit eliminar on confirm delete', () => {
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      component.onEliminar();
      component.onConfirmEliminar();
      expect(host.eliminado).toBe('c1');
    });
  });

  describe('documentos management', () => {
    it('should add a documento row', () => {
      fixture.detectChanges();
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      expect(component.documentosArray.length).toBe(0);
      component.addDocumento();
      expect(component.documentosArray.length).toBe(1);
    });

    it('should remove a documento row', () => {
      fixture.detectChanges();
      const component = fixture.debugElement.children[0].componentInstance as ClienteModalComponent;
      component.addDocumento();
      component.addDocumento();
      expect(component.documentosArray.length).toBe(2);
      component.removeDocumento(0);
      expect(component.documentosArray.length).toBe(1);
    });
  });

  describe('cerrar', () => {
    it('should emit cerrar on cancel', () => {
      fixture.detectChanges();
      const cancelBtn = fixture.nativeElement.querySelector('.modal-footer .btn-outline-secondary');
      cancelBtn.click();
      expect(host.cerrado).toBe(true);
    });
  });
});
