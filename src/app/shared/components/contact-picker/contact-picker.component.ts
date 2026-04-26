import {
  Component, inject, input, output, signal, computed, OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Contacto, TIPO_NEGOCIO_ICON } from '../../models/contacto.model';
import { ContactoService } from '../../../services/contacto.service';
import { ContactoFormComponent } from '../../../features/contactos/contacto-form/contacto-form.component';

@Component({
  selector: 'app-contact-picker',
  imports: [FormsModule, ContactoFormComponent],
  templateUrl: './contact-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactPickerComponent implements OnInit {
  readonly initialContactoId = input<string | undefined>(undefined);
  readonly seleccionado      = output<Contacto>();

  private contactoService = inject(ContactoService);

  readonly TIPO_NEGOCIO_ICON = TIPO_NEGOCIO_ICON;

  readonly query    = signal('');
  readonly contactos = signal<Contacto[]>([]);
  readonly selected = signal<Contacto | null>(null);
  readonly showNuevoModal = signal(false);
  readonly loading  = signal(true);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const qDigits = q.replace(/\D/g, '');
    return this.contactos().filter(c => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (qDigits && c.phone.replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    }).slice(0, 20);
  });

  ngOnInit(): void {
    this.contactoService.getContactos().subscribe(list => {
      this.contactos.set(list);
      this.loading.set(false);
      const initId = this.initialContactoId();
      if (initId) {
        const found = list.find(c => c.id === initId);
        if (found) this.selected.set(found);
      }
    });
  }

  pick(c: Contacto): void {
    this.selected.set(c);
    this.query.set('');
    this.seleccionado.emit(c);
  }

  clear(): void {
    this.selected.set(null);
  }

  openNuevo(): void {
    this.showNuevoModal.set(true);
  }

  closeNuevo(): void {
    this.showNuevoModal.set(false);
  }

  async onNuevoGuardar(event: { data: Partial<Contacto>; id?: string }): Promise<void> {
    const newId = await this.contactoService.addContacto(event.data);
    this.closeNuevo();
    // Synthesize the new contact locally — getContactos() will refresh the list,
    // but we can't await the observable; pick optimistically from the form data
    const optimistic: Contacto = {
      id:              newId,
      phone:           event.data.phone           ?? '',
      normalizedPhone: '',
      name:            event.data.name            ?? '',
      whatsappLabel:   event.data.whatsappLabel   ?? 'NM',
      businessTypes:   event.data.businessTypes   ?? ['general'],
      status:          event.data.status          ?? 'nuevo_mensaje',
      location:        event.data.location        ?? {},
      kanbanCardIds:   [],
      academiaHistory: event.data.academiaHistory,
      notas:           event.data.notas           ?? '',
      createdAt:       new Date(),
      lastMessageAt:   new Date(),
      lastSyncAt:      new Date()
    };
    this.pick(optimistic);
  }
}
