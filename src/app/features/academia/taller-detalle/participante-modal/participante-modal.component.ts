import { Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Participante, COMO_NOS_CONOCIO_OPCIONES } from '../../../../shared/models/taller.model';

@Component({
  selector: 'app-participante-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './participante-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParticipanteModalComponent implements OnInit {
  readonly participante = input<Participante | null>(null);
  readonly cerrar       = output<void>();
  readonly guardar      = output<{ data: Partial<Participante>; id?: string }>();
  readonly eliminar     = output<string>();

  readonly COMO_NOS_CONOCIO = COMO_NOS_CONOCIO_OPCIONES;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    nombreCompleto:  ['', Validators.required],
    whatsapp:        [''],
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
    const num = (this.form.get('whatsapp')?.value ?? '').replace(/\D/g, '');
    return `https://wa.me/57${num}`;
  }

  ngOnInit(): void {
    const p = this.participante();
    if (p) {
      this.form.patchValue({
        nombreCompleto:  p.nombreCompleto,
        whatsapp:        p.whatsapp,
        email:           p.email,
        ciudadOrigen:    p.ciudadOrigen,
        comoNosConocio:  p.comoNosConocio,
        pago:            p.pago,
        montoPagado:     p.montoPagado,
        notas:           p.notas
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
    try {
      const v = this.form.value;
      const data: Partial<Participante> = {
        nombreCompleto:  v.nombreCompleto  ?? '',
        whatsapp:        (v.whatsapp ?? '').replace(/\D/g, ''),
        email:           v.email           ?? '',
        ciudadOrigen:    v.ciudadOrigen    ?? '',
        comoNosConocio:  v.comoNosConocio as Participante['comoNosConocio'],
        pago:            v.pago            ?? false,
        montoPagado:     v.pago ? (v.montoPagado ?? null) : null,
        notas:           v.notas           ?? ''
      };
      this.guardar.emit({ data, id: this.participante()?.id });
    } finally {
      this.saving.set(false);
    }
  }

  onEliminar(): void { this.confirmDelete.set(true); }
  onConfirmEliminar(): void {
    const id = this.participante()?.id;
    if (id) this.eliminar.emit(id);
  }
}
