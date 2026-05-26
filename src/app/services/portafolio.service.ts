import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData,
  setDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import {
  ProyectoPortafolio, FirestorePortafolioProyecto, FotoPortafolio,
} from '../shared/models/portafolio.model';

@Injectable({ providedIn: 'root' })
export class PortafolioService {
  private firestore = inject(Firestore);
  private storage   = inject(Storage);
  private auth      = inject(Auth);
  private injector  = inject(Injector);

  private col = collection(this.firestore, 'portafolioProyectos');

  getProyectos(): Observable<ProyectoPortafolio[]> {
    const q = query(this.col, orderBy('orden', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestorePortafolioProyecto[]).map(d => this.fromFirestore(d)))
    );
  }

  getProyecto(id: string): Observable<ProyectoPortafolio | undefined> {
    return docData(doc(this.firestore, 'portafolioProyectos', id), { idField: 'id' }).pipe(
      map(d => d ? this.fromFirestore(d as FirestorePortafolioProyecto) : undefined)
    );
  }

  async saveProyecto(id: string, data: Partial<ProyectoPortafolio>, isNew: boolean): Promise<void> {
    const email = this.auth.currentUser?.email ?? '';
    const docRef = doc(this.firestore, 'portafolioProyectos', id);

    if (isNew) {
      await runInInjectionContext(this.injector, () =>
        setDoc(docRef, {
          ...this.toFirestore(data),
          creadoPor:     email,
          creadoEn:      serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        })
      );
    } else {
      await runInInjectionContext(this.injector, () =>
        updateDoc(docRef, {
          ...this.toFirestore(data),
          actualizadoEn: serverTimestamp(),
        })
      );
    }
  }

  async deleteProyecto(proyecto: ProyectoPortafolio): Promise<void> {
    if (!proyecto.id) return;

    for (const foto of proyecto.fotos) {
      try {
        await this.deleteFoto(foto.storagePath);
      } catch (err) {
        console.warn('No se pudo borrar foto del Storage:', foto.storagePath, err);
      }
    }

    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'portafolioProyectos', proyecto.id!))
    );
  }

  async uploadFoto(file: File, proyectoId: string): Promise<FotoPortafolio> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `portafolio/${proyectoId}/${Date.now()}-${safeName}`;
    const fileRef = ref(this.storage, storagePath);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return { url, storagePath };
  }

  async deleteFoto(storagePath: string): Promise<void> {
    const fileRef = ref(this.storage, storagePath);
    await deleteObject(fileRef);
  }

  private fromFirestore(d: FirestorePortafolioProyecto): ProyectoPortafolio {
    return {
      id:               d.id,
      nombre:           d.nombre ?? '',
      descripcion:      d.descripcion ?? '',
      ubicacion:        d.ubicacion ?? '',
      anio:             d.anio ?? new Date().getFullYear(),
      tipoProyecto:     d.tipoProyecto ?? 'otro',
      fotos:            d.fotos ?? [],
      fotoPortadaIndex: d.fotoPortadaIndex ?? 0,
      destacado:        d.destacado ?? false,
      orden:            d.orden ?? 0,
      activo:           d.activo ?? true,
      creadoEn:         d.creadoEn?.toDate() ?? new Date(),
      actualizadoEn:    d.actualizadoEn?.toDate() ?? new Date(),
      creadoPor:        d.creadoPor ?? '',
    };
  }

  private toFirestore(p: Partial<ProyectoPortafolio>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (p.nombre !== undefined)           out['nombre']           = p.nombre;
    if (p.descripcion !== undefined)      out['descripcion']      = p.descripcion;
    if (p.ubicacion !== undefined)        out['ubicacion']        = p.ubicacion;
    if (p.anio !== undefined)             out['anio']             = p.anio;
    if (p.tipoProyecto !== undefined)     out['tipoProyecto']     = p.tipoProyecto;
    if (p.fotos !== undefined)            out['fotos']            = p.fotos;
    if (p.fotoPortadaIndex !== undefined) out['fotoPortadaIndex'] = p.fotoPortadaIndex;
    if (p.destacado !== undefined)        out['destacado']        = p.destacado;
    if (p.orden !== undefined)            out['orden']            = p.orden;
    if (p.activo !== undefined)           out['activo']           = p.activo;
    return out;
  }
}
