import { Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Cliente, TIPOS_PROYECTO, ESTADOS_CLIENTE, DocumentoLink } from '../../../shared/models/cliente.model';

@Component({
  selector: 'app-cliente-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './cliente-modal.component.html',
  styleUrl: './cliente-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClienteModalComponent implements OnInit {
  readonly cliente  = input<Cliente | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ data: Partial<Cliente>; id?: string }>();
  readonly eliminar = output<string>();

  readonly TIPOS_PROYECTO  = TIPOS_PROYECTO;
  readonly ESTADOS_CLIENTE = ESTADOS_CLIENTE;

  private fb = inject(FormBuilder);

  // Initialized at field level so [formGroup] never receives undefined
  form = this.fb.group({
    nombre:               ['', Validators.required],
    tipoProyecto:         [''],
    municipio:            [''],
    whatsapp:             [''],
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
        nombre:              c.nombre,
        tipoProyecto:        c.tipoProyecto,
        municipio:           c.municipio,
        whatsapp:            c.whatsapp,
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
    }
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
    const num = (this.form.get('whatsapp')?.value ?? '').replace(/\D/g, '');
    return `https://wa.me/57${num}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const v = this.form.value;
      const data: Partial<Cliente> = {
        nombre:              v.nombre ?? '',
        tipoProyecto:        v.tipoProyecto as Cliente['tipoProyecto'],
        municipio:           v.municipio ?? '',
        whatsapp:            v.whatsapp ?? '',
        fechaUltimoContacto: this.toDate(v.fechaUltimoContacto ?? ''),
        fechaEstimadaInicio: this.toDate(v.fechaEstimadaInicio ?? ''),
        notas:               v.notas ?? '',
        documentos:          (v.documentos as DocumentoLink[]).filter(d => d.url?.trim()),
        recordatorioFecha:   this.toDate(v.recordatorioFecha ?? ''),
        recordatorioMensaje: v.recordatorioMensaje ?? '',
        estado:              v.estado as Cliente['estado']
      };
      this.guardar.emit({ data, id: this.cliente()?.id });
    } finally {
      this.saving.set(false);
    }
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
