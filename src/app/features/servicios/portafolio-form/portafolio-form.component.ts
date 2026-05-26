import {
  Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

import { PortafolioService } from '../../../services/portafolio.service';
import {
  ProyectoPortafolio, FotoPortafolio, MAX_FOTOS_POR_PROYECTO,
  TIPOS_PROYECTO_PORTAFOLIO, TIPOS_PROYECTO_PORTAFOLIO_LABELS,
} from '../../../shared/models/portafolio.model';

@Component({
  selector: 'app-portafolio-form',
  imports: [ReactiveFormsModule],
  templateUrl: './portafolio-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortafolioFormComponent implements OnInit {
  readonly proyecto = input<ProyectoPortafolio | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ id: string; data: Partial<ProyectoPortafolio>; isNew: boolean }>();
  readonly eliminar = output<ProyectoPortafolio>();

  readonly TIPOS_PROYECTO_PORTAFOLIO        = TIPOS_PROYECTO_PORTAFOLIO;
  readonly TIPOS_PROYECTO_PORTAFOLIO_LABELS = TIPOS_PROYECTO_PORTAFOLIO_LABELS;
  readonly MAX_FOTOS = MAX_FOTOS_POR_PROYECTO;

  private fb               = inject(FormBuilder);
  private portafolioService = inject(PortafolioService);

  form = this.fb.group({
    nombre:       ['', Validators.required],
    descripcion:  [''],
    ubicacion:    ['', Validators.required],
    anio:         this.fb.nonNullable.control(new Date().getFullYear(), Validators.required),
    tipoProyecto: this.fb.nonNullable.control<typeof TIPOS_PROYECTO_PORTAFOLIO[number]>('finca', Validators.required),
    destacado:    this.fb.nonNullable.control(false),
    orden:        this.fb.nonNullable.control(99),
  });

  readonly fotos        = signal<FotoPortafolio[]>([]);
  readonly portadaIndex = signal<number>(0);

  readonly proyectoId   = signal<string>('');
  readonly isNew        = signal<boolean>(true);
  readonly saving       = signal(false);
  readonly uploading    = signal(false);
  readonly confirmDelete = signal(false);
  readonly fotoError    = signal<string | null>(null);

  ngOnInit(): void {
    const p = this.proyecto();
    if (p && p.id) {
      this.proyectoId.set(p.id);
      this.isNew.set(false);
      this.form.patchValue({
        nombre:       p.nombre,
        descripcion:  p.descripcion,
        ubicacion:    p.ubicacion,
        anio:         p.anio,
        tipoProyecto: p.tipoProyecto,
        destacado:    p.destacado,
        orden:        p.orden,
      });
      this.fotos.set([...p.fotos]);
      this.portadaIndex.set(p.fotoPortadaIndex);
    } else {
      this.proyectoId.set(crypto.randomUUID());
      this.isNew.set(true);
    }
  }

  async onFotoSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const remaining = this.MAX_FOTOS - this.fotos().length;
    if (remaining <= 0) {
      this.fotoError.set(`Máximo ${this.MAX_FOTOS} fotos por proyecto.`);
      input.value = '';
      return;
    }

    const filesToUpload = Array.from(input.files).slice(0, remaining);
    const skipped = input.files.length - filesToUpload.length;
    if (skipped > 0) {
      this.fotoError.set(`Se omitieron ${skipped} foto(s); máximo ${this.MAX_FOTOS} por proyecto.`);
    } else {
      this.fotoError.set(null);
    }

    this.uploading.set(true);
    try {
      for (const file of filesToUpload) {
        const foto = await this.portafolioService.uploadFoto(file, this.proyectoId());
        this.fotos.update(arr => [...arr, foto]);
      }
    } catch (err) {
      console.error(err);
      this.fotoError.set('No se pudieron subir todas las fotos.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async eliminarFoto(index: number): Promise<void> {
    const foto = this.fotos()[index];
    if (!foto) return;
    try {
      await this.portafolioService.deleteFoto(foto.storagePath);
    } catch (err) {
      console.warn('No se pudo borrar foto del Storage; continuando:', err);
    }
    this.fotos.update(arr => arr.filter((_, i) => i !== index));
    if (this.portadaIndex() === index) {
      this.portadaIndex.set(0);
    } else if (this.portadaIndex() > index) {
      this.portadaIndex.update(v => v - 1);
    }
  }

  setPortada(index: number): void {
    this.portadaIndex.set(index);
  }

  updateCaption(index: number, value: string): void {
    this.fotos.update(arr => arr.map((f, i) => i === index ? { ...f, caption: value } : f));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    const data: Partial<ProyectoPortafolio> = {
      nombre:           v.nombre || '',
      descripcion:      v.descripcion || '',
      ubicacion:        v.ubicacion || '',
      anio:             Number(v.anio) || new Date().getFullYear(),
      tipoProyecto:     v.tipoProyecto,
      fotos:            this.fotos(),
      fotoPortadaIndex: this.fotos().length === 0 ? 0 : Math.min(this.portadaIndex(), this.fotos().length - 1),
      destacado:        v.destacado,
      orden:            Number(v.orden) || 99,
      activo:           true,
    };

    this.guardar.emit({ id: this.proyectoId(), data, isNew: this.isNew() });
    this.saving.set(false);
  }

  onEliminar(): void {
    const p = this.proyecto();
    if (p) this.eliminar.emit(p);
  }
}
