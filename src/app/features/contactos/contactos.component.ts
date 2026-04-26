import {
  Component, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { ContactoService } from '../../services/contacto.service';
import {
  Contacto,
  TipoNegocio, EstadoContacto,
  TIPOS_NEGOCIO, TIPOS_NEGOCIO_LABELS,
  ESTADOS_CONTACTO, ESTADOS_CONTACTO_LABELS,
  STATUS_BADGE_CLASS, TIPO_NEGOCIO_ICON
} from '../../shared/models/contacto.model';
import { ContactoFormComponent } from './contacto-form/contacto-form.component';

type QuickFilter = 'todos' | TipoNegocio | 'leads' | 'clientes';

@Component({
  selector: 'app-contactos',
  imports: [DatePipe, FormsModule, ContactoFormComponent],
  templateUrl: './contactos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactosComponent {
  private contactoService = inject(ContactoService);
  private router          = inject(Router);

  // Expose constants to template
  readonly TIPOS_NEGOCIO        = TIPOS_NEGOCIO;
  readonly TIPOS_NEGOCIO_LABELS = TIPOS_NEGOCIO_LABELS;
  readonly ESTADOS_CONTACTO_LABELS = ESTADOS_CONTACTO_LABELS;
  readonly TIPO_NEGOCIO_ICON    = TIPO_NEGOCIO_ICON;

  // ── Data stream ─────────────────────────────────────────────────────────────
  private readonly contactosRaw = toSignal(this.contactoService.getContactos());

  readonly loading    = computed(() => this.contactosRaw() === undefined);
  readonly contactos  = computed(() => this.contactosRaw() ?? []);

  // ── Filter state ────────────────────────────────────────────────────────────
  readonly quickFilter  = signal<QuickFilter>('todos');
  readonly searchQuery  = signal('');
  readonly statusFilter = signal<EstadoContacto | ''>('');

  // ── Filtered list (computed) ─────────────────────────────────────────────────
  readonly filtered = computed(() => {
    let list = this.contactos();

    // Quick filter chips
    const qf = this.quickFilter();
    if (qf === 'leads') {
      list = list.filter(c => c.status === 'lead' || c.status === 'interesado');
    } else if (qf === 'clientes') {
      list = list.filter(c => c.status === 'cliente');
    } else if (qf !== 'todos') {
      list = list.filter(c => c.businessTypes.includes(qf as TipoNegocio));
    }

    // Status filter
    const sf = this.statusFilter();
    if (sf) {
      list = list.filter(c => c.status === sf);
    }

    // Search
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.location.city?.toLowerCase().includes(q) ?? false)
      );
    }

    return list;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  readonly totalContactos  = computed(() => this.contactos().length);
  readonly totalLeads      = computed(() => this.contactos().filter(c => c.status === 'lead').length);
  readonly totalClientes   = computed(() => this.contactos().filter(c => c.status === 'cliente').length);
  readonly totalNuevos     = computed(() => this.contactos().filter(c => c.status === 'nuevo_mensaje').length);

  // ── Modal state ──────────────────────────────────────────────────────────────
  readonly showModal       = signal(false);
  readonly selectedContact = signal<Contacto | null>(null);
  readonly error           = signal<string | null>(null);

  // ── Actions ──────────────────────────────────────────────────────────────────

  openNuevoContacto(): void {
    this.selectedContact.set(null);
    this.showModal.set(true);
  }

  openEditarContacto(contacto: Contacto, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedContact.set(contacto);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedContact.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModal();
    }
  }

  goToDetalle(contacto: Contacto): void {
    this.router.navigate(['/contactos', contacto.id]);
  }

  async onGuardar(event: { data: Partial<Contacto>; id?: string }): Promise<void> {
    try {
      this.error.set(null);
      if (event.id) {
        await this.contactoService.updateContacto(event.id, event.data);
      } else {
        await this.contactoService.addContacto(event.data);
      }
      this.closeModal();
    } catch {
      this.error.set('Error al guardar el contacto. Intente de nuevo.');
    }
  }

  async onEliminar(id: string): Promise<void> {
    try {
      this.error.set(null);
      await this.contactoService.deleteContacto(id);
      this.closeModal();
    } catch {
      this.error.set('Error al eliminar el contacto. Intente de nuevo.');
    }
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  statusBadgeClass(status: EstadoContacto): string {
    return STATUS_BADGE_CLASS[status] ?? 'bg-secondary';
  }

  statusLabel(status: EstadoContacto): string {
    return ESTADOS_CONTACTO_LABELS[status] ?? status;
  }

  businessTypeIcons(types: TipoNegocio[]): string {
    return types.map(t => TIPO_NEGOCIO_ICON[t]).join(' ');
  }

  whatsappHref(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/${clean}`;
  }

  telHref(phone: string): string {
    return `tel:${phone}`;
  }

  readonly ESTADOS_CONTACTO = ESTADOS_CONTACTO;
}
