import {
  Component, inject, input, output, OnInit, signal, ChangeDetectionStrategy
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  FormBuilder, FormGroup, FormArray,
  Validators, ReactiveFormsModule
} from '@angular/forms';

import {
  Servicio, TipoServicio, PrecioServicio, ComponenteServicio, Rubro,
  TIPOS_SERVICIO, TIPOS_SERVICIO_LABELS,
  RUBROS, RUBROS_LABELS,
} from '../../../shared/models/servicio.model';

@Component({
  selector: 'app-servicio-form',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './servicio-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServicioFormComponent implements OnInit {
  readonly servicio = input<Servicio | null>(null);
  readonly cerrar   = output<void>();
  readonly guardar  = output<{ data: Partial<Servicio>; id?: string }>();
  readonly eliminar = output<string>();

  readonly TIPOS_SERVICIO        = TIPOS_SERVICIO;
  readonly TIPOS_SERVICIO_LABELS = TIPOS_SERVICIO_LABELS;
  readonly RUBROS                = RUBROS;
  readonly RUBROS_LABELS         = RUBROS_LABELS;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    tipo:             this.fb.nonNullable.control<TipoServicio>('asesoria_online', Validators.required),
    nombre:           ['', Validators.required],
    descripcion:      [''],
    queIncluye:       [''],
    queHaceElNegocio: [''],
    precioModo:       this.fb.nonNullable.control<PrecioServicio['modo']>('fijo'),
    precioValor:      this.fb.control<number | null>(0),
    precioMin:        this.fb.control<number | null>(0),
    precioMax:        this.fb.control<number | null>(0),
    precioPorM2:      this.fb.control<number | null>(0),
    activo:           this.fb.nonNullable.control(true),
    orden:            this.fb.nonNullable.control(99),
    componentes:      this.fb.array<FormGroup>([]),
  });

  readonly saving        = signal(false);
  readonly confirmDelete = signal(false);

  readonly precioModo = signal<PrecioServicio['modo']>('fijo');

  ngOnInit(): void {
    const s = this.servicio();
    if (s) {
      this.form.patchValue({
        tipo:             s.tipo,
        nombre:           s.nombre,
        descripcion:      s.descripcion,
        queIncluye:       s.queIncluye,
        queHaceElNegocio: s.queHaceElNegocio,
        precioModo:       s.precio.modo,
        activo:           s.activo,
        orden:            s.orden,
      });
      switch (s.precio.modo) {
        case 'fijo':
          this.form.patchValue({ precioValor: s.precio.valor });
          break;
        case 'rango':
          this.form.patchValue({ precioMin: s.precio.min, precioMax: s.precio.max });
          break;
        case 'por_m2':
          this.form.patchValue({ precioPorM2: s.precio.valorPorM2 });
          break;
      }
      this.precioModo.set(s.precio.modo);

      for (const c of s.componentes) {
        this.componentes.push(this.makeComponenteGroup(c));
      }
    }

    this.form.get('precioModo')!.valueChanges.subscribe(v => {
      if (v) this.precioModo.set(v);
    });
  }

  get componentes(): FormArray<FormGroup> {
    return this.form.get('componentes') as FormArray<FormGroup>;
  }

  componentesPorRubro(rubro: Rubro): { group: FormGroup; index: number }[] {
    const out: { group: FormGroup; index: number }[] = [];
    this.componentes.controls.forEach((g, i) => {
      if (g.get('rubro')!.value === rubro) {
        out.push({ group: g, index: i });
      }
    });
    return out;
  }

  totalRubro(rubro: Rubro): number {
    let total = 0;
    for (const g of this.componentes.controls) {
      if (g.get('rubro')!.value !== rubro) continue;
      const precio = Number(g.get('precioUnitario')!.value) || 0;
      const cant   = Number(g.get('cantidadDefault')!.value) || 0;
      total += precio * cant;
    }
    return total;
  }

  totalGeneral(): number {
    return this.RUBROS.reduce((sum, r) => sum + this.totalRubro(r), 0);
  }

  agregarComponente(rubro: Rubro): void {
    this.componentes.push(this.makeComponenteGroup({
      nombre: '', rubro, unidad: 'unidad', precioUnitario: 0, cantidadDefault: 1,
    }));
  }

  eliminarComponente(index: number): void {
    this.componentes.removeAt(index);
  }

  private makeComponenteGroup(c: ComponenteServicio): FormGroup {
    return this.fb.group({
      nombre:          this.fb.nonNullable.control(c.nombre, Validators.required),
      rubro:           this.fb.nonNullable.control<Rubro>(c.rubro, Validators.required),
      unidad:          this.fb.nonNullable.control(c.unidad ?? 'unidad'),
      precioUnitario:  this.fb.nonNullable.control(c.precioUnitario ?? 0),
      cantidadDefault: this.fb.nonNullable.control(c.cantidadDefault ?? 1),
      notas:           this.fb.nonNullable.control(c.notas ?? ''),
    });
  }

  mostrarComponentes(): boolean {
    const t = this.form.get('tipo')!.value as TipoServicio;
    return t === 'fase_ruta1' || t === 'gran_escala_ruta2';
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();

    let precio: PrecioServicio;
    switch (v.precioModo) {
      case 'fijo':
        precio = { modo: 'fijo', valor: Number(v.precioValor) || 0 };
        break;
      case 'rango':
        precio = { modo: 'rango', min: Number(v.precioMin) || 0, max: Number(v.precioMax) || 0 };
        break;
      case 'por_m2':
        precio = { modo: 'por_m2', valorPorM2: Number(v.precioPorM2) || 0 };
        break;
    }

    const componentes: ComponenteServicio[] = this.mostrarComponentes()
      ? this.componentes.controls.map(g => ({
          nombre:          g.get('nombre')!.value,
          rubro:           g.get('rubro')!.value as Rubro,
          unidad:          g.get('unidad')!.value,
          precioUnitario:  Number(g.get('precioUnitario')!.value) || 0,
          cantidadDefault: Number(g.get('cantidadDefault')!.value) || 0,
          notas:           g.get('notas')!.value || '',
        }))
      : [];

    const data: Partial<Servicio> = {
      tipo:             v.tipo,
      nombre:           v.nombre || '',
      descripcion:      v.descripcion || '',
      queIncluye:       v.queIncluye || '',
      queHaceElNegocio: v.queHaceElNegocio || '',
      precio,
      componentes,
      activo:           v.activo,
      orden:            Number(v.orden) || 99,
    };

    this.guardar.emit({ data, id: this.servicio()?.id });
    this.saving.set(false);
  }

  onEliminar(): void {
    const id = this.servicio()?.id;
    if (id) this.eliminar.emit(id);
  }
}
