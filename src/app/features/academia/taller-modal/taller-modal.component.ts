import { Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Taller, ESTADOS_TALLER } from '../../../shared/models/taller.model';

@Component({
  selector: 'app-taller-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './taller-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TallerModalComponent implements OnInit {
  readonly taller   = input<Taller | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ data: Partial<Taller>; id?: string }>();
  readonly eliminar = output<string>();

  readonly ESTADOS_TALLER = ESTADOS_TALLER;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    nombre:          ['', Validators.required],
    numero:          [null as number | null],
    fechaInicio:     [''],
    fechaFin:        [''],
    ubicacion:       [''],
    municipio:       [''],
    cupoMaximo:      [null as number | null],
    precio:          [null as number | null],
    descripcion:     [''],
    estado:          ['Próximo'],
    enlaceReserva:   [''],
    notasInternas:   ['']
  });

  saving        = signal(false);
  confirmDelete = signal(false);

  ngOnInit(): void {
    const t = this.taller();
    if (t) {
      this.form.patchValue({
        nombre:        t.nombre,
        numero:        t.numero,
        fechaInicio:   this.toDateStr(t.fechaInicio),
        fechaFin:      this.toDateStr(t.fechaFin),
        ubicacion:     t.ubicacion,
        municipio:     t.municipio,
        cupoMaximo:    t.cupoMaximo,
        precio:        t.precio,
        descripcion:   t.descripcion,
        estado:        t.estado,
        enlaceReserva: t.enlaceReserva,
        notasInternas: t.notasInternas
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    const v = this.form.value;
    const data: Partial<Taller> = {
      nombre:        v.nombre        ?? '',
      numero:        v.numero        ?? null,
      fechaInicio:   this.toDate(v.fechaInicio ?? ''),
      fechaFin:      this.toDate(v.fechaFin    ?? ''),
      ubicacion:     v.ubicacion     ?? '',
      municipio:     v.municipio     ?? '',
      cupoMaximo:    v.cupoMaximo    ?? null,
      precio:        v.precio        ?? null,
      descripcion:   v.descripcion   ?? '',
      estado:        v.estado as Taller['estado'],
      enlaceReserva: v.enlaceReserva ?? '',
      notasInternas: v.notasInternas ?? ''
    };
    // Keep saving=true until the modal closes — prevents double-submit.
    this.guardar.emit({ data, id: this.taller()?.id });
  }

  onEliminar(): void { this.confirmDelete.set(true); }
  onConfirmEliminar(): void {
    const id = this.taller()?.id;
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
