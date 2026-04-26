import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp, query, orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import { Cliente, FirestoreCliente } from '../shared/models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(Injector);

  private col = collection(this.firestore, 'clientes');

  getClientes(): Observable<Cliente[]> {
    const q = query(this.col, orderBy('creadoEn', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreCliente[]).map(d => this.fromFirestore(d)))
    );
  }

  async addCliente(data: Partial<Cliente>): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      addDoc(this.col, {
        ...this.toFirestore(data),
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
        creadoPor: this.auth.currentUser?.email ?? ''
      })
    );
  }

  async updateCliente(id: string, updates: Partial<Cliente>): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'clientes', id), {
        ...this.toFirestore(updates),
        actualizadoEn: serverTimestamp()
      })
    );
  }

  async deleteCliente(id: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'clientes', id))
    );
  }

  private toFirestore(data: Partial<Cliente>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      if (value instanceof Date) {
        result[key] = Timestamp.fromDate(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private fromFirestore(data: FirestoreCliente): Cliente {
    return {
      id:                  data.id,
      contactoId:          data.contactoId ?? '',
      nombre:              data.nombre ?? '',
      tipoProyecto:        data.tipoProyecto ?? '',
      municipio:           data.municipio ?? '',
      whatsapp:            data.whatsapp ?? '',
      fechaUltimoContacto: data.fechaUltimoContacto?.toDate() ?? null,
      fechaEstimadaInicio: data.fechaEstimadaInicio?.toDate() ?? null,
      notas:               data.notas ?? '',
      documentos:          data.documentos ?? [],
      recordatorioFecha:   data.recordatorioFecha?.toDate() ?? null,
      recordatorioMensaje: data.recordatorioMensaje ?? '',
      estado:              data.estado ?? 'Contacto Inicial',
      creadoEn:            data.creadoEn?.toDate() ?? new Date(),
      creadoPor:           data.creadoPor ?? '',
      actualizadoEn:       data.actualizadoEn?.toDate() ?? new Date(),
    };
  }
}
