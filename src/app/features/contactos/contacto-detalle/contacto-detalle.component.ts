import {
  Component, inject, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { ContactoService } from '../../../services/contacto.service';
import {
  Contacto,
  ESTADOS_CONTACTO_LABELS, STATUS_BADGE_CLASS,
  TIPOS_NEGOCIO_LABELS, TIPO_NEGOCIO_ICON,
  TipoNegocio, EstadoContacto
} from '../../../shared/models/contacto.model';
import { ContactoFormComponent } from '../contacto-form/contacto-form.component';
import { MessageHistoryComponent } from '../message-history/message-history.component';

@Component({
  selector: 'app-contacto-detalle',
  imports: [DatePipe, DecimalPipe, RouterLink, ContactoFormComponent, MessageHistoryComponent],
  templateUrl: './contacto-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactoDetalleComponent {
  private contactoService = inject(ContactoService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  // Expose constants to template
  readonly ESTADOS_CONTACTO_LABELS = ESTADOS_CONTACTO_LABELS;
  readonly STATUS_BADGE_CLASS      = STATUS_BADGE_CLASS;
  readonly TIPOS_NEGOCIO_LABELS    = TIPOS_NEGOCIO_LABELS;
  readonly TIPO_NEGOCIO_ICON       = TIPO_NEGOCIO_ICON;

  // ── Data ────────────────────────────────────────────────────────────────────
  private readonly contactoRaw = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.contactoService.getContacto(params.get('id')!))
    )
  );

  readonly loading  = computed(() => this.contactoRaw() === undefined);
  readonly contacto = computed(() => this.contactoRaw() ?? null);

  // ── Active tab ──────────────────────────────────────────────────────────────
  readonly activeTab = signal<'info' | 'mensajes' | 'academia'>('info');

  // ── Edit modal ──────────────────────────────────────────────────────────────
  readonly showEditModal = signal(false);
  readonly error         = signal<string | null>(null);

  // ── Actions ─────────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/contactos']);
  }

  openEditModal(): void {
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeEditModal();
    }
  }

  async onGuardar(event: { data: Partial<Contacto>; id?: string }): Promise<void> {
    try {
      this.error.set(null);
      if (event.id) {
        await this.contactoService.updateContacto(event.id, event.data);
      }
      this.closeEditModal();
    } catch {
      this.error.set('Error al guardar. Intente de nuevo.');
    }
  }

  async onEliminar(id: string): Promise<void> {
    try {
      this.error.set(null);
      await this.contactoService.deleteContacto(id);
      this.router.navigate(['/contactos']);
    } catch {
      this.error.set('Error al eliminar. Intente de nuevo.');
    }
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  statusBadgeClass(status: EstadoContacto): string {
    return STATUS_BADGE_CLASS[status] ?? 'bg-secondary';
  }

  statusLabel(status: EstadoContacto): string {
    return ESTADOS_CONTACTO_LABELS[status] ?? status;
  }

  typeLabel(type: TipoNegocio): string {
    return TIPOS_NEGOCIO_LABELS[type];
  }

  typeIcon(type: TipoNegocio): string {
    return TIPO_NEGOCIO_ICON[type];
  }

  whatsappHref(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/${clean}`;
  }

  telHref(phone: string): string {
    return `tel:${phone}`;
  }

  mapsHref(contacto: Contacto): string {
    const { coordinates, address, city } = contacto.location;
    if (coordinates) {
      return `https://maps.google.com/?q=${coordinates.lat},${coordinates.lng}`;
    }
    const query = [address, city].filter(Boolean).join(', ');
    return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
  }

  hasLocation(contacto: Contacto): boolean {
    return !!(contacto.location.city || contacto.location.address || contacto.location.coordinates);
  }

  scheduleLabel(schedule?: string): string {
    const map: Record<string, string> = {
      weekday: 'Días de semana',
      weekend: 'Fines de semana',
      evening: 'Noches'
    };
    return schedule ? (map[schedule] ?? schedule) : '—';
  }

  lastMessageRelative(date: Date | null | undefined): string {
    if (!date) return 'Sin mensajes registrados';

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1)   return 'Hace un momento';
    if (diffMin < 60)  return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)   return `Hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)   return `Hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;

    const diffWk = Math.floor(diffDay / 7);
    if (diffDay < 30)  return `Hace ${diffWk} ${diffWk === 1 ? 'semana' : 'semanas'}`;

    const diffMo = Math.floor(diffDay / 30);
    if (diffDay < 365) return `Hace ${diffMo} ${diffMo === 1 ? 'mes' : 'meses'}`;

    const diffYr = Math.floor(diffDay / 365);
    return `Hace ${diffYr} ${diffYr === 1 ? 'año' : 'años'}`;
  }
}
