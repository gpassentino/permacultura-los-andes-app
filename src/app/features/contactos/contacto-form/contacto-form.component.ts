import {
  Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  Contacto,
  WHATSAPP_LABELS, ESTADOS_CONTACTO, ESTADOS_CONTACTO_LABELS,
  TIPOS_NEGOCIO, TIPOS_NEGOCIO_LABELS, MUNICIPIOS,
  TipoNegocio
} from '../../../shared/models/contacto.model';

@Component({
  selector: 'app-contacto-form',
  imports: [ReactiveFormsModule],
  templateUrl: './contacto-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactoFormComponent implements OnInit {
  readonly contacto = input<Contacto | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ data: Partial<Contacto>; id?: string }>();
  readonly eliminar = output<string>();

  // Expose constants to template
  readonly WHATSAPP_LABELS        = WHATSAPP_LABELS;
  readonly ESTADOS_CONTACTO       = ESTADOS_CONTACTO;
  readonly ESTADOS_CONTACTO_LABELS = ESTADOS_CONTACTO_LABELS;
  readonly TIPOS_NEGOCIO          = TIPOS_NEGOCIO;
  readonly TIPOS_NEGOCIO_LABELS   = TIPOS_NEGOCIO_LABELS;
  readonly MUNICIPIOS             = MUNICIPIOS;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    name:             ['', Validators.required],
    phone:            ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-()]{7,20}$/)]],
    whatsappLabel:    ['NM'],
    status:           ['nuevo_mensaje'],
    city:             [''],
    address:          [''],
    notas:            [''],
    // Academia history
    preferredSchedule: ['']
  });

  // Checkboxes for businessTypes (array, not standard form control)
  readonly selectedTypes = signal<Set<TipoNegocio>>(new Set());

  saving        = signal(false);
  confirmDelete = signal(false);

  ngOnInit(): void {
    const c = this.contacto();
    if (c) {
      this.form.patchValue({
        name:              c.name,
        phone:             c.phone,
        whatsappLabel:     c.whatsappLabel,
        status:            c.status,
        city:              c.location.city ?? '',
        address:           c.location.address ?? '',
        notas:             c.notas ?? '',
        preferredSchedule: c.academiaHistory?.preferredSchedule ?? ''
      });
      this.selectedTypes.set(new Set(c.businessTypes));
    }
  }

  toggleType(type: TipoNegocio): void {
    this.selectedTypes.update(set => {
      const next = new Set(set);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  isTypeSelected(type: TipoNegocio): boolean {
    return this.selectedTypes().has(type);
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
      const types = Array.from(this.selectedTypes());

      const data: Partial<Contacto> = {
        name:           v.name          ?? '',
        phone:          v.phone         ?? '',
        whatsappLabel:  v.whatsappLabel as Contacto['whatsappLabel'],
        status:         v.status        as Contacto['status'],
        businessTypes:  types.length > 0 ? types : ['general'],
        location: {
          ...(v.city    ? { city:    v.city    } : {}),
          ...(v.address ? { address: v.address } : {})
        },
        notas: v.notas ?? '',
        academiaHistory: {
          ...(this.contacto()?.academiaHistory ?? {
            completedTalleres:  [],
            interestedTalleres: []
          }),
          ...(v.preferredSchedule
            ? { preferredSchedule: v.preferredSchedule as 'weekday' | 'weekend' | 'evening' }
            : {})
        }
      };

      this.guardar.emit({ data, id: this.contacto()?.id });
    } finally {
      this.saving.set(false);
    }
  }

  onEliminar(): void { this.confirmDelete.set(true); }

  onConfirmEliminar(): void {
    const id = this.contacto()?.id;
    if (id) this.eliminar.emit(id);
  }
}
