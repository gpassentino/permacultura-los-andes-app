import { Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormArray, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Cliente, TIPOS_PROYECTO, ESTADOS_CLIENTE, DocumentoLink } from '../../../shared/models/cliente.model';
import { Contacto } from '../../../shared/models/contacto.model';
import { ContactoService } from '../../../services/contacto.service';
import { ContactPickerComponent } from '../../../shared/components/contact-picker/contact-picker.component';

@Component({
  selector: 'app-cliente-modal',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, ContactPickerComponent],
  templateUrl: './cliente-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClienteModalComponent implements OnInit {
  readonly cliente  = input<Cliente | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ data: Partial<Cliente>; id?: string }>();
  readonly eliminar = output<string>();

  readonly TIPOS_PROYECTO  = TIPOS_PROYECTO;
  readonly ESTADOS_CLIENTE = ESTADOS_CLIENTE;

  private fb              = inject(FormBuilder);
  private contactoService = inject(ContactoService);

  // The selected canonical Contacto (source of truth for name/phone)
  readonly contactoSeleccionado = signal<Contacto | null>(null);

  // Card-specific form (no nombre/whatsapp/municipio — those come from Contacto)
  form = this.fb.group({
    tipoProyecto:         [''],
    fechaUltimoContacto:  [''],
    fechaEstimadaInicio:  [''],
    notas:                [''],
    recordatorioFecha:    [''],
    recordatorioMensaje:  [''],
    estado:               ['Contacto Inicial'],
    documentos:           this.fb.array([])
  });

  saving        = signal(false);
  confirmDelete = signal(false);

  ngOnInit(): void {
    const c = this.cliente();
    if (c) {
      this.form.patchValue({
        tipoProyecto:        c.tipoProyecto,
        fechaUltimoContacto: this.toDateStr(c.fechaUltimoContacto),
        fechaEstimadaInicio: this.toDateStr(c.fechaEstimadaInicio),
        notas:               c.notas,
        recordatorioFecha:   this.toDateStr(c.recordatorioFecha),
        recordatorioMensaje: c.recordatorioMensaje,
        estado:              c.estado
      });
      const arr = this.documentosArray;
      arr.clear();
      (c.documentos ?? []).forEach(d =>
        arr.push(this.fb.group({ label: [d.label], url: [d.url] }))
      );
      // Hydrate the linked Contacto for the picker's initial state
      if (c.contactoId) {
        firstValueFrom(this.contactoService.getContacto(c.contactoId)).then(contacto => {
          if (contacto) this.contactoSeleccionado.set(contacto);
        });
      }
    }
  }

  onContactoSeleccionado(c: Contacto): void {
    this.contactoSeleccionado.set(c);
  }

  get documentosArray(): FormArray {
    return this.form.get('documentos') as FormArray;
  }

  addDocumento(): void {
    this.documentosArray.push(this.fb.group({ label: [''], url: [''] }));
  }

  removeDocumento(i: number): void {
    this.documentosArray.removeAt(i);
  }

  get whatsappUrl(): string {
    const num = (this.contactoSeleccionado()?.phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${num}`;
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
    const data: Partial<Cliente> = {
      contactoId:          contacto.id,
      nombre:              contacto.name,
      whatsapp:            contacto.phone,
      municipio:           contacto.location.city ?? '',
      tipoProyecto:        v.tipoProyecto as Cliente['tipoProyecto'],
      fechaUltimoContacto: this.toDate(v.fechaUltimoContacto ?? ''),
      fechaEstimadaInicio: this.toDate(v.fechaEstimadaInicio ?? ''),
      notas:               v.notas ?? '',
      documentos:          (v.documentos as DocumentoLink[]).filter(d => d.url?.trim()),
      recordatorioFecha:   this.toDate(v.recordatorioFecha ?? ''),
      recordatorioMensaje: v.recordatorioMensaje ?? '',
      estado:              v.estado as Cliente['estado']
    };
    // Keep saving=true until the modal closes — prevents double-submit.
    // The parent (TableroComponent) closes the modal on success or surfaces an error.
    this.guardar.emit({ data, id: this.cliente()?.id });
  }

  onEliminar(): void { this.confirmDelete.set(true); }
  onConfirmEliminar(): void {
    const id = this.cliente()?.id;
    if (id) this.eliminar.emit(id);
  }

  private toDateStr(date?: Date | null): string {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toDate(str: string): Date | null {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
