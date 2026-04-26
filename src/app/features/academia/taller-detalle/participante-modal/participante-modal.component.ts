import { Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Participante, COMO_NOS_CONOCIO_OPCIONES } from '../../../../shared/models/taller.model';
import { Contacto } from '../../../../shared/models/contacto.model';
import { ContactoService } from '../../../../services/contacto.service';
import { ContactPickerComponent } from '../../../../shared/components/contact-picker/contact-picker.component';

@Component({
  selector: 'app-participante-modal',
  imports: [ReactiveFormsModule, RouterLink, ContactPickerComponent],
  templateUrl: './participante-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParticipanteModalComponent implements OnInit {
  readonly participante = input<Participante | null>(null);
  readonly cerrar       = output<void>();
  readonly guardar      = output<{ data: Partial<Participante>; id?: string }>();
  readonly eliminar     = output<string>();

  readonly COMO_NOS_CONOCIO = COMO_NOS_CONOCIO_OPCIONES;

  private fb              = inject(FormBuilder);
  private contactoService = inject(ContactoService);

  readonly contactoSeleccionado = signal<Contacto | null>(null);

  // Participante-specific form (no nombre/whatsapp — those come from Contacto)
  form = this.fb.group({
    email:           ['', [Validators.email]],
    ciudadOrigen:    [''],
    comoNosConocio:  [''],
    pago:            [false],
    montoPagado:     [null as number | null],
    notas:           ['']
  });

  saving        = signal(false);
  confirmDelete = signal(false);

  get whatsappUrl(): string {
    const num = (this.contactoSeleccionado()?.phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${num}`;
  }

  ngOnInit(): void {
    const p = this.participante();
    if (p) {
      this.form.patchValue({
        email:           p.email,
        ciudadOrigen:    p.ciudadOrigen,
        comoNosConocio:  p.comoNosConocio,
        pago:            p.pago,
        montoPagado:     p.montoPagado,
        notas:           p.notas
      });
      if (p.contactoId) {
        firstValueFrom(this.contactoService.getContacto(p.contactoId)).then(contacto => {
          if (contacto) this.contactoSeleccionado.set(contacto);
        });
      }
    }
  }

  onContactoSeleccionado(c: Contacto): void {
    this.contactoSeleccionado.set(c);
    // Pre-fill ciudad from contact location if not already set
    if (!this.form.get('ciudadOrigen')?.value && c.location.city) {
      this.form.patchValue({ ciudadOrigen: c.location.city });
    }
  }

  async onSubmit(): Promise<void> {
    const contacto = this.contactoSeleccionado();
    if (!contacto || !contacto.id) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    const v = this.form.value;
    const data: Partial<Participante> = {
      contactoId:      contacto.id,
      nombreCompleto:  contacto.name,
      whatsapp:        contacto.phone,
      email:           v.email           ?? '',
      ciudadOrigen:    v.ciudadOrigen    ?? '',
      comoNosConocio:  v.comoNosConocio as Participante['comoNosConocio'],
      pago:            v.pago            ?? false,
      montoPagado:     v.pago ? (v.montoPagado ?? null) : null,
      notas:           v.notas           ?? ''
    };
    // Keep saving=true until the modal closes — prevents double-submit.
    this.guardar.emit({ data, id: this.participante()?.id });
  }

  onEliminar(): void { this.confirmDelete.set(true); }
  onConfirmEliminar(): void {
    const id = this.participante()?.id;
    if (id) this.eliminar.emit(id);
  }
}
