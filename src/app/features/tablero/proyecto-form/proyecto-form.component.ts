import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactPickerComponent } from '../../../shared/components/contact-picker/contact-picker.component';
import { Contacto, MUNICIPIOS } from '../../../shared/models/contacto.model';
import { ETAPAS_FLUJO_LABELS, EtapaFlujo } from '../../../shared/models/proyecto-flujo.model';
import { PATRON_CODIGO, sugerirCodigo } from '../../../shared/logic/flujo';
import { CodigoEnUsoError, ProyectoFlujoService } from '../../../services/proyecto-flujo.service';
import { ServicioRef } from '../proyecto-vista';

@Component({
  selector: 'app-proyecto-form',
  imports: [FormsModule, ContactPickerComponent],
  templateUrl: './proyecto-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoFormComponent {
  readonly servicios     = input.required<ServicioRef[]>();
  readonly codigosUsados = input.required<ReadonlySet<string>>();
  readonly cerrar        = output<void>();
  readonly creado        = output<string>();

  private proyectoService = inject(ProyectoFlujoService);

  readonly MUNICIPIOS = MUNICIPIOS;
  readonly ETAPAS_INICIALES: EtapaFlujo[] = ['contacto', 'propuesta'];
  readonly ETAPAS_FLUJO_LABELS = ETAPAS_FLUJO_LABELS;

  readonly contacto       = signal<Contacto | null>(null);
  readonly nombreProyecto = signal('');
  readonly codigoManual   = signal<string | null>(null);
  readonly servicioIds    = signal<string[]>([]);
  readonly municipio      = signal('');
  readonly etapa          = signal<EtapaFlujo>('contacto');
  readonly guardando      = signal(false);
  readonly error          = signal<string | null>(null);
  readonly intentoGuardar = signal(false);

  /** Código sugerido a partir del nombre, salvo que el usuario lo haya editado. */
  readonly codigo = computed(() =>
    this.codigoManual() ?? sugerirCodigo(this.nombreProyecto(), this.codigosUsados()));

  readonly codigoValido = computed(() => PATRON_CODIGO.test(this.codigo()));
  readonly codigoEnUso  = computed(() => this.codigoManual() !== null && this.codigosUsados().has(this.codigo()));

  readonly valido = computed(() =>
    !!this.contacto()?.id && this.nombreProyecto().trim().length > 0 && this.codigoValido() && !this.codigoEnUso());

  onContacto(c: Contacto): void {
    this.contacto.set(c);
    // Sugerir el municipio del contacto si lo tiene
    if (!this.municipio() && c.location?.city) this.municipio.set(c.location.city);
  }

  onCodigo(valor: string): void {
    const limpio = valor.toUpperCase().replace(/\s+/g, '');
    this.codigoManual.set(limpio || null);
  }

  toggleServicio(id: string): void {
    const ids = this.servicioIds();
    this.servicioIds.set(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  async guardar(): Promise<void> {
    this.intentoGuardar.set(true);
    if (!this.valido() || this.guardando()) return;
    const conVisita = this.servicios()
      .some(s => s.tipo === 'asesoria_in_situ' && this.servicioIds().includes(s.id));

    this.guardando.set(true);
    this.error.set(null);
    try {
      const id = await this.proyectoService.crearProyecto({
        contactoId:     this.contacto()!.id!,
        codigo:         this.codigo(),
        nombreProyecto: this.nombreProyecto().trim(),
        municipio:      this.municipio() || undefined,
        etapaFlujo:     this.etapa(),
        etapaEjecucion: null,
        servicioIds:    this.servicioIds(),
        visitaTecnica:  conVisita ? 'pendiente' : 'no_aplica',
        documentos:     [],
      });
      this.creado.emit(id);
    } catch (e) {
      this.error.set(e instanceof CodigoEnUsoError
        ? `El código ${e.codigo} ya está en uso. Elige otro.`
        : 'No se pudo crear el proyecto. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
