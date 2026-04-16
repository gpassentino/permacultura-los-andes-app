import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ClienteCardComponent } from './cliente-card.component';
import { Cliente } from '../../../shared/models/cliente.model';

function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: '1',
    nombre: 'Test Cliente',
    tipoProyecto: '',
    municipio: '',
    whatsapp: '',
    fechaUltimoContacto: null,
    fechaEstimadaInicio: null,
    notas: '',
    documentos: [],
    recordatorioFecha: null,
    recordatorioMensaje: '',
    estado: 'Contacto Inicial',
    creadoEn: new Date(),
    creadoPor: '',
    actualizadoEn: new Date(),
    ...overrides,
  };
}

@Component({
  imports: [ClienteCardComponent],
  template: '<app-cliente-card [cliente]="cliente()" />',
})
class TestHostComponent {
  cliente = signal(makeCliente());
}

describe('ClienteCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    const card = fixture.nativeElement.querySelector('.cliente-card');
    expect(card).toBeTruthy();
  });

  it('should display client name', () => {
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Test Cliente');
  });

  describe('diasDesdeContacto', () => {
    it('should return null when no contact date', () => {
      host.cliente.set(makeCliente({ fechaUltimoContacto: null }));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('sin contacto');
    });

    it('should show days since last contact', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      host.cliente.set(makeCliente({ fechaUltimoContacto: fiveDaysAgo }));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('5d sin contacto');
    });
  });

  describe('recordatorio indicators', () => {
    it('should show danger badge for overdue reminder', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      host.cliente.set(makeCliente({ recordatorioFecha: yesterday, recordatorioMensaje: 'Llamar' }));
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge.bg-danger');
      expect(badge).toBeTruthy();
    });

    it('should show warning badge for upcoming reminder', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      host.cliente.set(makeCliente({ recordatorioFecha: tomorrow, recordatorioMensaje: 'Seguimiento' }));
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge.bg-warning');
      expect(badge).toBeTruthy();
    });

    it('should show no badge when no reminder', () => {
      host.cliente.set(makeCliente({ recordatorioFecha: null }));
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.badge.bg-danger, .badge.bg-warning');
      expect(badges.length).toBe(0);
    });
  });

  describe('whatsappUrl', () => {
    it('should format URL with +57 prefix', () => {
      host.cliente.set(makeCliente({ whatsapp: '3001234567' }));
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a[href*="wa.me"]');
      expect(link?.href).toContain('wa.me/573001234567');
    });
  });

  describe('tipoBadgeClass', () => {
    it('should show correct badge for project type', () => {
      host.cliente.set(makeCliente({ tipoProyecto: 'Consultoría' }));
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.badge.bg-secondary');
      expect(badge?.textContent?.trim()).toBe('Consultoría');
    });
  });

  describe('border classes', () => {
    it('should have border-danger for overdue reminder', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      host.cliente.set(makeCliente({ recordatorioFecha: yesterday }));
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.cliente-card');
      expect(card.classList.contains('border-danger')).toBe(true);
    });
  });
});
