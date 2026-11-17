import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData, doc,
  query, where, runTransaction, serverTimestamp, Timestamp, deleteField,
} from '@angular/fire/firestore';
import { Storage, ref as storageRef, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import {
  Carril, Documento, EtapaEjecucion, EtapaFlujo, ProyectoFlujo,
} from '../shared/models/proyecto-flujo.model';
import {
  aplicarMovimiento, aplicarSiguienteFase, CambiosMovimiento, PATRON_CODIGO,
} from '../shared/logic/flujo';
import { aFirestore, deFirestore } from '../shared/utils/firestore-fechas';

const COL = 'proyectosFlujo';
/** Reserva de códigos únicos: `codigosProyecto/{PLA-XXX}` → { proyectoId }. */
const COL_CODIGOS = 'codigosProyecto';

export class CodigoEnUsoError extends Error {
  constructor(public codigo: string) {
    super(`El código ${codigo} ya está en uso`);
    this.name = 'CodigoEnUsoError';
  }
}

export type NuevoProyectoFlujo = Omit<ProyectoFlujo,
  'id' | 'historial' | 'etapaFlujoDesde' | 'etapaEjecucionDesde' |
  'creadoEn' | 'creadoPor' | 'actualizadoEn' | 'migradoEn'>;

/** Campos que no se editan con `actualizarProyecto` (tienen su propio método). */
type CamposProtegidos = 'id' | 'codigo' | 'etapaFlujo' | 'etapaFlujoDesde' |
  'etapaEjecucion' | 'etapaEjecucionDesde' | 'historial' | 'creadoEn' | 'creadoPor';

@Injectable({ providedIn: 'root' })
export class ProyectoFlujoService {
  private firestore = inject(Firestore);
  private auth      = inject(Auth);
  private storage   = inject(Storage);
  private injector  = inject(Injector);

  private col = collection(this.firestore, COL);

  // ── Lectura ─────────────────────────────────────────────────────────────────

  getProyectos(): Observable<ProyectoFlujo[]> {
    return collectionData(this.col, { idField: 'id' }).pipe(
      map(docs => docs.map(d => this.fromFirestore(d))),
    );
  }

  getProyecto(id: string): Observable<ProyectoFlujo | undefined> {
    return docData(doc(this.firestore, COL, id), { idField: 'id' }).pipe(
      map(d => (d ? this.fromFirestore(d) : undefined)),
    );
  }

  getProyectosByContacto(contactoId: string): Observable<ProyectoFlujo[]> {
    const q = query(this.col, where('contactoId', '==', contactoId));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => docs.map(d => this.fromFirestore(d))),
    );
  }

  // ── Escritura ───────────────────────────────────────────────────────────────

  /** Crea el proyecto y reserva su código en la misma transacción. */
  async crearProyecto(data: NuevoProyectoFlujo): Promise<string> {
    const codigo = data.codigo.trim().toUpperCase();
    if (!PATRON_CODIGO.test(codigo)) throw new Error(`Código inválido: ${codigo}`);
    const ahora = new Date();

    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async tx => {
        const codigoRef = doc(this.firestore, COL_CODIGOS, codigo);
        if ((await tx.get(codigoRef)).exists()) throw new CodigoEnUsoError(codigo);

        const ref = doc(this.col);
        const proyecto: Omit<ProyectoFlujo, 'id'> = {
          ...data,
          codigo,
          etapaFlujoDesde: ahora,
          historial: [{ etapa: data.etapaFlujo, carril: 'diseno', desde: ahora }],
          creadoEn: ahora,
          creadoPor: this.auth.currentUser?.email ?? '',
          actualizadoEn: ahora,
        };
        if (data.etapaEjecucion) {
          proyecto.etapaEjecucionDesde = ahora;
          proyecto.historial.push({ etapa: data.etapaEjecucion, carril: 'ejecucion', desde: ahora });
        }
        tx.set(codigoRef, { proyectoId: ref.id, creadoEn: serverTimestamp() });
        tx.set(ref, { ...this.toFirestore(proyecto), actualizadoEn: serverTimestamp() });
        return ref.id;
      }),
    );
  }

  /**
   * Edición de campos libres (ficha). Etapas y código tienen sus propios métodos.
   * Una clave presente con valor `undefined` borra el campo (p. ej. quitar el próximo paso).
   */
  async actualizarProyecto(id: string, cambios: Partial<Omit<ProyectoFlujo, CamposProtegidos>>): Promise<void> {
    const borrar = Object.entries(cambios).filter(([, v]) => v === undefined).map(([k]) => k);
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async tx => {
        const ref = doc(this.firestore, COL, id);
        if (!(await tx.get(ref)).exists()) throw new Error('Proyecto no encontrado');
        const patch: Record<string, unknown> = { ...this.toFirestore(cambios), actualizadoEn: serverTimestamp() };
        for (const k of borrar) patch[k] = deleteField();
        tx.update(ref, patch);
      }),
    );
  }

  /** Sube un archivo (p. ej. un escaneo firmado) y devuelve su URL de descarga. */
  async subirArchivo(proyectoId: string, file: File): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileRef = storageRef(this.storage, `proyectosFlujo/${proyectoId}/documentos/${Date.now()}-${safeName}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }

  /** Cambia el código liberando el anterior, en una transacción. */
  async cambiarCodigo(id: string, nuevo: string): Promise<void> {
    const codigo = nuevo.trim().toUpperCase();
    if (!PATRON_CODIGO.test(codigo)) throw new Error(`Código inválido: ${codigo}`);
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async tx => {
        const ref = doc(this.firestore, COL, id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Proyecto no encontrado');
        const anterior = (snap.data() as { codigo?: string }).codigo;
        if (anterior === codigo) return;
        const nuevoRef = doc(this.firestore, COL_CODIGOS, codigo);
        if ((await tx.get(nuevoRef)).exists()) throw new CodigoEnUsoError(codigo);
        tx.set(nuevoRef, { proyectoId: id, creadoEn: serverTimestamp() });
        if (anterior) tx.delete(doc(this.firestore, COL_CODIGOS, anterior));
        const revisar = ((snap.data() as { revisar?: string[] }).revisar ?? []).filter(r => r !== 'codigo');
        tx.update(ref, { codigo, revisar, actualizadoEn: serverTimestamp() });
      }),
    );
  }

  /** Mueve de etapa: actualiza `...Desde` y agrega la entrada al historial. */
  async moverEtapa(
    id: string,
    carril: Carril,
    destino: EtapaFlujo | EtapaEjecucion,
    opciones: { motivoCierre?: string; servicioIdsEjecucion?: readonly string[] } = {},
  ): Promise<void> {
    await this.escribir(id, async actual => aplicarMovimiento(actual, carril, destino, new Date(), opciones));
  }

  /**
   * "Continuar con siguiente fase": mismo proyecto; agrega el servicio y vuelve
   * a `diseno`, o activa el carril de ejecución.
   */
  async agregarSiguienteFase(id: string, servicioId: string, servicioNombre: string, esEjecucion: boolean): Promise<void> {
    await this.escribir(id, async actual =>
      aplicarSiguienteFase(actual, servicioId, servicioNombre, esEjecucion, new Date()));
  }

  /**
   * Agrega un documento. Punto de enganche de la futura calculadora de
   * cotizaciones: guardará su PDF como `{ tipo: 'cotizacion', etapa: 'propuesta' }`.
   */
  async agregarDocumento(id: string, documento: Omit<Documento, 'id'>): Promise<string> {
    const docId = doc(collection(this.firestore, '_')).id;
    await this.escribir(id, async actual => ({
      documentos: [...actual.documentos, { ...documento, id: docId }],
    }));
    return docId;
  }

  async quitarDocumento(id: string, documentoId: string): Promise<void> {
    await this.escribir(id, async actual => ({
      documentos: actual.documentos.filter(d => d.id !== documentoId),
    }));
  }

  /** Borra el proyecto y libera su código. */
  async eliminarProyecto(id: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async tx => {
        const ref = doc(this.firestore, COL, id);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const codigo = (snap.data() as { codigo?: string }).codigo;
        if (codigo) tx.delete(doc(this.firestore, COL_CODIGOS, codigo));
        tx.delete(ref);
      }),
    );
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  /** Lee el estado actual dentro de una transacción y aplica los cambios calculados. */
  private async escribir(
    id: string,
    calcular: (actual: ProyectoFlujo) => Promise<CambiosMovimiento | Partial<ProyectoFlujo> | null>,
  ): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async tx => {
        const ref = doc(this.firestore, COL, id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Proyecto no encontrado');
        const actual = this.fromFirestore({ ...snap.data(), id });
        const cambios = await calcular(actual);
        if (!cambios) return;
        tx.update(ref, { ...this.toFirestore(cambios), actualizadoEn: serverTimestamp() });
      }),
    );
  }

  private toFirestore(data: Partial<ProyectoFlujo>): Record<string, unknown> {
    const { id: _id, ...resto } = data;
    return aFirestore(resto, d => Timestamp.fromDate(d)) as Record<string, unknown>;
  }

  private fromFirestore(raw: unknown): ProyectoFlujo {
    const d = deFirestore<Partial<ProyectoFlujo>>(raw);
    const ahora = new Date();
    return {
      ...d,
      contactoId:      d.contactoId ?? '',
      codigo:          d.codigo ?? '',
      nombreProyecto:  d.nombreProyecto ?? '',
      etapaFlujo:      d.etapaFlujo ?? 'contacto',
      etapaFlujoDesde: d.etapaFlujoDesde ?? d.creadoEn ?? ahora,
      etapaEjecucion:  d.etapaEjecucion ?? null,
      servicioIds:     d.servicioIds ?? [],
      visitaTecnica:   d.visitaTecnica ?? 'no_aplica',
      documentos:      d.documentos ?? [],
      historial:       d.historial ?? [],
      creadoEn:        d.creadoEn ?? ahora,
      creadoPor:       d.creadoPor ?? '',
      actualizadoEn:   d.actualizadoEn ?? ahora,
    };
  }
}
