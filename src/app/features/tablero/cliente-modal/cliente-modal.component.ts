import { Component, inject, input, output, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormArray, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Cliente,
  ChecklistItem,
  CategoriaCliente,
  CATEGORIAS_CLIENTE,
  ESTADOS_CLIENTE,
  FaseChecklist,
  FASES_CHECKLIST,
  DocumentoLink,
  buildChecklistFromTemplate
} from '../../../shared/models/cliente.model';
import { Contacto } from '../../../shared/models/contacto.model';
import { ContactoService } from '../../../services/contacto.service';
import { ContactPickerComponent } from '../../../shared/components/contact-picker/contact-picker.component';

type Tab = 'detalles' | 'checklist';

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

  readonly CATEGORIAS_CLIENTE = CATEGORIAS_CLIENTE;
  readonly ESTADOS_CLIENTE    = ESTADOS_CLIENTE;
  readonly FASES_CHECKLIST    = FASES_CHECKLIST;

  private fb              = inject(FormBuilder);
  private contactoService = inject(ContactoService);

  // The selected canonical Contacto (source of truth for name/phone)
  readonly contactoSeleccionado = signal<Contacto | null>(null);

  // Working copy of checklist (lives outside the FormGroup since it's array-of-objects with mixed types)
  readonly checklist = signal<ChecklistItem[]>([]);

  readonly activeTab = signal<Tab>('detalles');

  // Pending categoría change awaiting user confirmation (would replace existing checklist)
  readonly pendingCategoriaChange = signal<CategoriaCliente | null>(null);

  // Tracks the categoría the checklist currently reflects, so we can detect real changes.
  // The form control value updates BEFORE (change) fires, so we can't use it as the "previous" value.
  private currentCategoria: CategoriaCliente = 'Indefinido';

  // Card-specific form (no nombre/whatsapp/municipio — those come from Contacto)
  form = this.fb.group({
    categoria:            ['Indefinido' as CategoriaCliente],
    fechaUltimoContacto:  [''],
    fechaEstimadaInicio:  [''],
    notas:                [''],
    recordatorioFecha:    [''],
    recordatorioMensaje:  [''],
    estado:               ['Antes'],
    documentos:           this.fb.array([])
  });

  saving        = signal(false);
  confirmDelete = signal(false);

  // Checklist progress for the badge in the tab header
  readonly checklistProgress = computed(() => {
    const items = this.checklist();
    const done = items.filter(i => i.completado).length;
    return { done, total: items.length };
  });

  ngOnInit(): void {
    const c = this.cliente();
    if (c) {
      this.form.patchValue({
        categoria:           c.categoria,
        fechaUltimoContacto: this.toDateStr(c.fechaUltimoContacto),
        fechaEstimadaInicio: this.toDateStr(c.fechaEstimadaInicio),
        notas:               c.notas,
        recordatorioFecha:   this.toDateStr(c.recordatorioFecha),
        recordatorioMensaje: c.recordatorioMensaje,
        estado:              c.estado
      });
      this.checklist.set([...c.checklist]);
      this.currentCategoria = c.categoria;
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
    } else {
      // New card: default to Indefinido (empty checklist)
      this.checklist.set(buildChecklistFromTemplate('Indefinido'));
      this.currentCategoria = 'Indefinido';
    }
  }

  onContactoSeleccionado(c: Contacto): void {
    this.contactoSeleccionado.set(c);
  }

  onCategoriaChange(event: Event): void {
    const newValue = (event.target as HTMLSelectElement).value as CategoriaCliente;
    if (newValue === this.currentCategoria) return;

    // If nothing's been done yet (no items, or none completed), seed directly without prompting.
    if (this.checklist().length === 0 || this.checklist().every(i => !i.completado)) {
      this.applyCategoria(newValue);
      return;
    }

    // Items have been ticked off — prompt before replacing. Revert the select for now.
    this.pendingCategoriaChange.set(newValue);
    this.form.controls.categoria.setValue(this.currentCategoria, { emitEvent: false });
  }

  confirmarCambioCategoria(): void {
    const newCategoria = this.pendingCategoriaChange();
    if (!newCategoria) return;
    this.applyCategoria(newCategoria);
    this.pendingCategoriaChange.set(null);
  }

  cancelarCambioCategoria(): void {
    this.pendingCategoriaChange.set(null);
  }

  private applyCategoria(categoria: CategoriaCliente): void {
    this.form.controls.categoria.setValue(categoria);
    this.checklist.set(buildChecklistFromTemplate(categoria));
    this.currentCategoria = categoria;
  }

  toggleChecklistItem(index: number): void {
    const items = [...this.checklist()];
    const item = items[index];
    items[index] = {
      ...item,
      completado: !item.completado,
      completadoEn: !item.completado ? new Date() : null,
    };
    this.checklist.set(items);
  }

  addChecklistItem(fase: FaseChecklist): void {
    const items = [...this.checklist()];
    items.push({ texto: '', fase, completado: false, completadoEn: null });
    this.checklist.set(items);
  }

  updateChecklistItemText(index: number, event: Event): void {
    const items = [...this.checklist()];
    items[index] = { ...items[index], texto: (event.target as HTMLInputElement).value };
    this.checklist.set(items);
  }

  removeChecklistItem(index: number): void {
    const items = [...this.checklist()];
    items.splice(index, 1);
    this.checklist.set(items);
  }

  itemsForFase(fase: FaseChecklist): { item: ChecklistItem; index: number }[] {
    return this.checklist()
      .map((item, index) => ({ item, index }))
      .filter(x => x.item.fase === fase);
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
    // Strip any blank-text checklist items the user added but never filled in
    const cleanedChecklist = this.checklist().filter(i => i.texto.trim().length > 0);
    const data: Partial<Cliente> = {
      contactoId:          contacto.id,
      nombre:              contacto.name,
      whatsapp:            contacto.phone,
      municipio:           contacto.location.city ?? '',
      categoria:           (v.categoria ?? 'Indefinido') as CategoriaCliente,
      checklist:           cleanedChecklist,
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
