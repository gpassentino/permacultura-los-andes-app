import {
  Component, ChangeDetectionStrategy, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  Carril, CASILLAS_DOCUMENTO, CasillaDocumento, Documento, ESTADOS_VISITA, ESTADOS_VISITA_LABELS,
  ETAPAS_EJECUCION_LABELS, ETAPAS_FLUJO_LABELS, EstadoVisita, MOTIVOS_CIERRE_LABELS, MotivoCierre,
  ProyectoFlujo, TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_LABELS, TipoDocumento,
} from '../../../shared/models/proyecto-flujo.model';
import { Contacto, MUNICIPIOS } from '../../../shared/models/contacto.model';
import { Cliente } from '../../../shared/models/cliente.model';
import { TIPOS_SERVICIO_EJECUCION } from '../../../shared/models/servicio.model';
import { diasEntre, PATRON_CODIGO } from '../../../shared/logic/flujo';
import { formatoHa } from '../../../shared/utils/formato';
import { CodigoEnUsoError, ProyectoFlujoService } from '../../../services/proyecto-flujo.service';
import { ProyectoVista, ServicioRef } from '../proyecto-vista';

type Pestana = 'ficha' | 'documentos' | 'historial';

const ETIQUETAS_REVISAR: Record<string, string> = {
  nombre:    'Nombre del proyecto (se tomó del nombre del cliente)',
  codigo:    'Código sugerido',
  servicios: 'Servicios (la categoría anterior no definía uno)',
  etapa:     'Etapa (la columna anterior no era clara)',
  contacto:  'Contacto (el registro anterior no tenía contacto)',
};

/** "2026-11-17" ↔ Date local (inputs type="date"). */
function aInputFecha(d?: Date | null): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function deInputFecha(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface FormFicha {
  nombreProyecto: string;
  municipio: string;
  areaHa: string;
  servicioIds: string[];
  visitaTecnica: EstadoVisita;
  visitaFecha: string;
  carpetaDriveUrl: string;
  proximoPasoTexto: string;
  proximoPasoFecha: string;
  notas: string;
}

interface FormDocumento {
  tipo: TipoDocumento;
  etapa: string;
  url: string;
  version: string;
  nota: string;
  conVersion: boolean;
}

@Component({
  selector: 'app-proyecto-ficha',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './proyecto-ficha.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoFichaComponent {
  readonly proyecto      = input.required<ProyectoVista>();
  readonly contacto      = input<Contacto | null>(null);
  readonly clienteLegacy = input<Cliente | null>(null);
  /** Catálogo completo de servicios. */
  readonly catalogo      = input.required<ServicioRef[]>();
  readonly cerrar        = output<void>();
  readonly mover         = output<Carril>();

  private proyectoService = inject(ProyectoFlujoService);

  readonly ETAPAS_FLUJO_LABELS = ETAPAS_FLUJO_LABELS;
  readonly ETAPAS_EJECUCION_LABELS = ETAPAS_EJECUCION_LABELS;
  readonly ESTADOS_VISITA = ESTADOS_VISITA;
  readonly ESTADOS_VISITA_LABELS = ESTADOS_VISITA_LABELS;
  readonly TIPOS_DOCUMENTO = TIPOS_DOCUMENTO;
  readonly TIPOS_DOCUMENTO_LABELS = TIPOS_DOCUMENTO_LABELS;
  readonly MUNICIPIOS = MUNICIPIOS;
  readonly formatoHa = formatoHa;

  readonly pestana   = signal<Pestana>('ficha');
  readonly guardando = signal(false);
  readonly error     = signal<string | null>(null);
  readonly aviso     = signal<string | null>(null);

  // ── Formulario de la pestaña Ficha ─────────────────────────────────────────
  readonly form  = signal<FormFicha>(this.formDesde(null));
  readonly dirty = signal(false);
  private cargadoId: string | null = null;

  /** Recarga el formulario al cambiar de proyecto, o si no hay cambios sin guardar. */
  private readonly sincronizar = effect(() => {
    const p = this.proyecto();
    if (p.id !== this.cargadoId || !this.dirty()) {
      this.cargadoId = p.id;
      this.form.set(this.formDesde(p));
      this.dirty.set(false);
    }
  });

  private formDesde(p: ProyectoFlujo | null): FormFicha {
    return {
      nombreProyecto:   p?.nombreProyecto ?? '',
      municipio:        p?.municipio ?? '',
      areaHa:           p?.areaHa != null ? String(p.areaHa).replace('.', ',') : '',
      servicioIds:      [...(p?.servicioIds ?? [])],
      visitaTecnica:    p?.visitaTecnica ?? 'no_aplica',
      visitaFecha:      aInputFecha(p?.visitaFecha),
      carpetaDriveUrl:  p?.carpetaDriveUrl ?? '',
      proximoPasoTexto: p?.proximoPaso?.texto ?? '',
      proximoPasoFecha: aInputFecha(p?.proximoPaso?.fecha),
      notas:            p?.notas ?? '',
    };
  }

  set<K extends keyof FormFicha>(campo: K, valor: FormFicha[K]): void {
    this.form.update(f => ({ ...f, [campo]: valor }));
    this.dirty.set(true);
  }

  toggleServicio(id: string): void {
    const ids = this.form().servicioIds;
    this.set('servicioIds', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  readonly areaValida = computed(() => {
    const a = this.form().areaHa.trim();
    return !a || !isNaN(Number(a.replace(',', '.')));
  });

  readonly formValido = computed(() => this.form().nombreProyecto.trim().length > 0 && this.areaValida());

  async guardarFicha(): Promise<void> {
    if (!this.formValido() || this.guardando()) return;
    const f = this.form();
    const area = f.areaHa.trim() ? Number(f.areaHa.replace(',', '.')) : undefined;
    const texto = f.proximoPasoTexto.trim();
    const fechaPaso = deInputFecha(f.proximoPasoFecha);
    await this.ejecutar(async () => {
      await this.proyectoService.actualizarProyecto(this.proyecto().id, {
        nombreProyecto:  f.nombreProyecto.trim(),
        municipio:       f.municipio.trim() || undefined,
        areaHa:          area,
        servicioIds:     f.servicioIds,
        visitaTecnica:   f.visitaTecnica,
        visitaFecha:     f.visitaTecnica === 'no_aplica' ? undefined : deInputFecha(f.visitaFecha),
        carpetaDriveUrl: f.carpetaDriveUrl.trim() || undefined,
        proximoPaso:     texto ? (fechaPaso ? { texto, fecha: fechaPaso } : { texto }) : undefined,
        notas:           f.notas.trim() || undefined,
      });
      this.dirty.set(false);
      this.aviso.set('Cambios guardados');
    });
  }

  descartar(): void {
    this.form.set(this.formDesde(this.proyecto()));
    this.dirty.set(false);
  }

  // ── Contacto ───────────────────────────────────────────────────────────────
  readonly whatsappUrl = computed(() => {
    const tel = (this.contacto()?.phone ?? this.proyecto().contactoTelefono).replace(/\D/g, '');
    return tel ? `https://wa.me/${tel.startsWith('57') ? tel : '57' + tel}` : null;
  });

  // ── Revisión ───────────────────────────────────────────────────────────────
  readonly revisar = computed(() =>
    (this.proyecto().revisar ?? []).map(r => ({ clave: r, label: ETIQUETAS_REVISAR[r] ?? r })));

  async marcarRevisado(clave?: string): Promise<void> {
    const resto = clave ? (this.proyecto().revisar ?? []).filter(r => r !== clave) : [];
    await this.ejecutar(() => this.proyectoService.actualizarProyecto(this.proyecto().id, { revisar: resto }));
  }

  // ── Código ─────────────────────────────────────────────────────────────────
  readonly editandoCodigo = signal(false);
  readonly nuevoCodigo    = signal('');

  editarCodigo(): void {
    this.nuevoCodigo.set(this.proyecto().codigo);
    this.editandoCodigo.set(true);
  }

  readonly nuevoCodigoValido = computed(() => PATRON_CODIGO.test(this.nuevoCodigo().trim().toUpperCase()));

  async guardarCodigo(): Promise<void> {
    if (!this.nuevoCodigoValido()) return;
    try {
      this.guardando.set(true);
      this.error.set(null);
      await this.proyectoService.cambiarCodigo(this.proyecto().id, this.nuevoCodigo());
      this.editandoCodigo.set(false);
    } catch (e) {
      this.error.set(e instanceof CodigoEnUsoError ? `El código ${e.codigo} ya está en uso.` : 'No se pudo cambiar el código.');
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Siguiente fase ─────────────────────────────────────────────────────────
  readonly siguienteServicioId = signal('');

  async agregarSiguienteFase(): Promise<void> {
    const s = this.catalogo().find(x => x.id === this.siguienteServicioId());
    if (!s) return;
    const esEjecucion = TIPOS_SERVICIO_EJECUCION.includes(s.tipo);
    const destino = esEjecucion ? 'activa el carril de ejecución' : 'vuelve el proyecto a Diseño';
    if (!confirm(`Agregar «${s.nombre}» a este proyecto: ${destino}. ¿Continuar?`)) return;
    await this.ejecutar(async () => {
      await this.proyectoService.agregarSiguienteFase(this.proyecto().id, s.id, s.nombre, esEjecucion);
      this.siguienteServicioId.set('');
      this.aviso.set(`Siguiente fase agregada: ${s.nombre}`);
    });
  }

  // ── Cierre ─────────────────────────────────────────────────────────────────
  readonly motivoCierreLabel = computed(() => {
    const m = this.proyecto().motivoCierre;
    if (!m) return '';
    if (m.startsWith('otro:')) return `Otro — ${m.slice(5).trim()}`;
    return MOTIVOS_CIERRE_LABELS[m as MotivoCierre] ?? m;
  });

  async eliminar(): Promise<void> {
    const p = this.proyecto();
    if (!confirm(`¿Eliminar el proyecto ${p.codigo} «${p.nombreProyecto}»? No se puede deshacer.`)) return;
    await this.ejecutar(async () => {
      await this.proyectoService.eliminarProyecto(p.id);
      this.cerrar.emit();
    });
  }

  // ── Documentos ─────────────────────────────────────────────────────────────
  readonly casillas = computed(() => {
    const p = this.proyecto();
    return CASILLAS_DOCUMENTO
      .filter(c => !c.soloSiVisita || p.visitaTecnica !== 'no_aplica')
      .map(c => ({ ...c, documentos: p.documentos.filter(d => d.tipo === c.tipo) }));
  });

  readonly otrosDocumentos = computed(() => {
    const tiposCasilla = new Set(CASILLAS_DOCUMENTO.map(c => c.tipo));
    return this.proyecto().documentos.filter(d => !tiposCasilla.has(d.tipo));
  });

  readonly formDoc  = signal<FormDocumento | null>(null);
  readonly archivo  = signal<File | null>(null);

  nuevoDocumento(casilla?: CasillaDocumento): void {
    this.archivo.set(null);
    this.formDoc.set({
      tipo:       casilla?.tipo ?? 'otro',
      etapa:      casilla?.etapa ?? this.proyecto().etapaFlujo,
      url:        '',
      version:    casilla?.conVersion ? `v${this.proyecto().documentos.filter(d => d.tipo === casilla.tipo).length + 1}` : '',
      nota:       '',
      conVersion: !!casilla?.conVersion,
    });
  }

  setDoc<K extends keyof FormDocumento>(campo: K, valor: FormDocumento[K]): void {
    this.formDoc.update(f => (f ? { ...f, [campo]: valor } : f));
  }

  onArchivo(event: Event): void {
    this.archivo.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  readonly formDocValido = computed(() => {
    const f = this.formDoc();
    if (!f) return false;
    return !!this.archivo() || /^https?:\/\//i.test(f.url.trim());
  });

  async guardarDocumento(): Promise<void> {
    const f = this.formDoc();
    if (!f || !this.formDocValido()) return;
    await this.ejecutar(async () => {
      const url = this.archivo()
        ? await this.proyectoService.subirArchivo(this.proyecto().id, this.archivo()!)
        : f.url.trim();
      const doc: Omit<Documento, 'id'> = { tipo: f.tipo, etapa: f.etapa, url, fecha: new Date() };
      if (f.version.trim()) doc.version = f.version.trim();
      if (f.nota.trim()) doc.nota = f.nota.trim();
      await this.proyectoService.agregarDocumento(this.proyecto().id, doc);
      this.formDoc.set(null);
      this.archivo.set(null);
    });
  }

  async quitarDocumento(d: Documento): Promise<void> {
    if (!confirm(`¿Quitar «${d.nota || TIPOS_DOCUMENTO_LABELS[d.tipo]}» del proyecto? El archivo en Drive no se borra.`)) return;
    await this.ejecutar(() => this.proyectoService.quitarDocumento(this.proyecto().id, d.id));
  }

  // ── Historial ──────────────────────────────────────────────────────────────
  readonly historial = computed(() => {
    const ahora = new Date();
    return [...this.proyecto().historial]
      .sort((a, b) => b.desde.getTime() - a.desde.getTime())
      .map(h => ({
        ...h,
        label: h.carril === 'ejecucion'
          ? ETAPAS_EJECUCION_LABELS[h.etapa as keyof typeof ETAPAS_EJECUCION_LABELS] ?? h.etapa
          : ETAPAS_FLUJO_LABELS[h.etapa as keyof typeof ETAPAS_FLUJO_LABELS] ?? h.etapa,
        dias: diasEntre(h.desde, h.hasta ?? ahora),
        actual: !h.hasta,
      }));
  });

  // ── Datos anteriores (registro de `clientes`) ──────────────────────────────
  readonly checklistAnterior = computed(() => this.clienteLegacy()?.checklist ?? []);

  // ── Util ───────────────────────────────────────────────────────────────────
  private async ejecutar(accion: () => Promise<unknown>): Promise<void> {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await accion();
    } catch {
      this.error.set('No se pudo guardar. Revisa la conexión e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
