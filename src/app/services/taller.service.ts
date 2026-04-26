import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData,
  addDoc, updateDoc, deleteDoc, doc, docData,
  serverTimestamp, Timestamp, query, orderBy,
  runTransaction, increment, arrayUnion, arrayRemove
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import {
  Taller, FirestoreTaller,
  Participante, FirestoreParticipante
} from '../shared/models/taller.model';

@Injectable({ providedIn: 'root' })
export class TallerService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private tallersCol = collection(this.firestore, 'talleres');

  // ── Talleres ─────────────────────────────────────────────────────

  getTalleres(): Observable<Taller[]> {
    const q = query(this.tallersCol, orderBy('fechaInicio', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreTaller[]).map(d => this.tallerFromFirestore(d)))
    );
  }

  getTaller(id: string): Observable<Taller | undefined> {
    return docData(doc(this.firestore, 'talleres', id), { idField: 'id' }).pipe(
      map(d => d ? this.tallerFromFirestore(d as FirestoreTaller) : undefined)
    );
  }

  async addTaller(data: Partial<Taller>): Promise<string> {
    const ref = await runInInjectionContext(this.injector, () =>
      addDoc(this.tallersCol, {
        ...this.tallerToFirestore(data),
        participantesCount: 0,
        totalRecaudado: 0,
        creadoEn: serverTimestamp()
      })
    );
    return ref.id;
  }

  async updateTaller(id: string, updates: Partial<Taller>): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'talleres', id), {
        ...this.tallerToFirestore(updates)
      })
    );
  }

  async deleteTaller(id: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'talleres', id))
    );
  }

  // ── Participantes ─────────────────────────────────────────────────

  getParticipantes(tallerId: string): Observable<Participante[]> {
    const col = collection(this.firestore, 'talleres', tallerId, 'participantes');
    const q   = query(col, orderBy('creadoEn', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreParticipante[]).map(d => this.participanteFromFirestore(d)))
    );
  }

  /**
   * Adds a participante and atomically updates the taller's
   * participantesCount (+1) and totalRecaudado (+montoPagado).
   * If `data.contactoId` is set, also pushes the taller id onto the
   * contact's academiaHistory (completedTalleres if taller is Finalizado,
   * interestedTalleres otherwise).
   */
  async addParticipante(tallerId: string, data: Partial<Participante>): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const partCol   = collection(this.firestore, 'talleres', tallerId, 'participantes');
        const tallerRef = doc(this.firestore, 'talleres', tallerId);
        const partRef   = doc(partCol);
        const monto = (data.pago && data.montoPagado) ? data.montoPagado : 0;

        // Read taller estado to decide which academiaHistory bucket to update
        let tallerEstado: Taller['estado'] | undefined;
        if (data.contactoId) {
          const tallerSnap = await tx.get(tallerRef);
          tallerEstado = (tallerSnap.data() as FirestoreTaller | undefined)?.estado;
        }

        tx.set(partRef, {
          ...this.participanteToFirestore(data),
          creadoEn: serverTimestamp()
        });
        tx.update(tallerRef, {
          participantesCount: increment(1),
          totalRecaudado:     increment(monto)
        });

        if (data.contactoId) {
          const contactRef = doc(this.firestore, 'contacts', data.contactoId);
          const bucket = tallerEstado === 'Finalizado'
            ? 'academiaHistory.completedTalleres'
            : 'academiaHistory.interestedTalleres';
          tx.update(contactRef, { [bucket]: arrayUnion(tallerId) });
        }
      })
    );
  }

  /**
   * Updates a participante and recalculates totalRecaudado delta atomically.
   */
  async updateParticipante(
    tallerId: string,
    participanteId: string,
    oldData: Participante,
    newData: Partial<Participante>
  ): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const partRef   = doc(this.firestore, 'talleres', tallerId, 'participantes', participanteId);
        const tallerRef = doc(this.firestore, 'talleres', tallerId);

        const oldMonto = (oldData.pago && oldData.montoPagado) ? oldData.montoPagado : 0;
        const newPago  = newData.pago  ?? oldData.pago;
        const newMonto = (newPago && newData.montoPagado != null)
          ? newData.montoPagado
          : (newPago ? (oldData.montoPagado ?? 0) : 0);
        const delta = newMonto - oldMonto;

        tx.update(partRef, this.participanteToFirestore(newData));
        if (delta !== 0) {
          tx.update(tallerRef, { totalRecaudado: increment(delta) });
        }
      })
    );
  }

  /**
   * Deletes a participante and decrements taller counters atomically.
   * Also pulls the taller id from both completedTalleres and interestedTalleres
   * on the linked contact (we don't know which bucket it's in without reading,
   * and arrayRemove is a no-op if the value isn't there).
   */
  async deleteParticipante(tallerId: string, participante: Participante): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const partRef   = doc(this.firestore, 'talleres', tallerId, 'participantes', participante.id!);
        const tallerRef = doc(this.firestore, 'talleres', tallerId);
        const monto = (participante.pago && participante.montoPagado) ? participante.montoPagado : 0;

        tx.delete(partRef);
        tx.update(tallerRef, {
          participantesCount: increment(-1),
          totalRecaudado:     increment(-monto)
        });

        if (participante.contactoId) {
          const contactRef = doc(this.firestore, 'contacts', participante.contactoId);
          tx.update(contactRef, {
            'academiaHistory.completedTalleres':  arrayRemove(tallerId),
            'academiaHistory.interestedTalleres': arrayRemove(tallerId)
          });
        }
      })
    );
  }

  // ── Firestore mapping helpers ─────────────────────────────────────

  private tallerToFirestore(data: Partial<Taller>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const skip = new Set(['id', 'participantesCount', 'totalRecaudado', 'creadoEn']);
    for (const [key, value] of Object.entries(data)) {
      if (skip.has(key)) continue;
      if (value instanceof Date) {
        result[key] = Timestamp.fromDate(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private tallerFromFirestore(data: FirestoreTaller): Taller {
    return {
      id:                 data.id,
      nombre:             data.nombre             ?? '',
      numero:             data.numero             ?? null,
      fechaInicio:        data.fechaInicio?.toDate()  ?? null,
      fechaFin:           data.fechaFin?.toDate()     ?? null,
      ubicacion:          data.ubicacion          ?? '',
      municipio:          data.municipio          ?? '',
      cupoMaximo:         data.cupoMaximo         ?? null,
      precio:             data.precio             ?? null,
      descripcion:        data.descripcion        ?? '',
      estado:             data.estado             ?? 'Próximo',
      enlaceReserva:      data.enlaceReserva      ?? '',
      notasInternas:      data.notasInternas      ?? '',
      participantesCount: data.participantesCount ?? 0,
      totalRecaudado:     data.totalRecaudado     ?? 0,
      creadoEn:           data.creadoEn?.toDate() ?? new Date()
    };
  }

  private participanteToFirestore(data: Partial<Participante>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const skip = new Set(['id', 'creadoEn']);
    for (const [key, value] of Object.entries(data)) {
      if (skip.has(key)) continue;
      if (value instanceof Date) {
        result[key] = Timestamp.fromDate(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private participanteFromFirestore(data: FirestoreParticipante): Participante {
    return {
      id:              data.id,
      contactoId:      data.contactoId      ?? '',
      nombreCompleto:  data.nombreCompleto  ?? '',
      whatsapp:        data.whatsapp        ?? '',
      email:           data.email           ?? '',
      ciudadOrigen:    data.ciudadOrigen    ?? '',
      comoNosConocio:  data.comoNosConocio  ?? '',
      pago:            data.pago            ?? false,
      montoPagado:     data.montoPagado     ?? null,
      notas:           data.notas           ?? '',
      creadoEn:        data.creadoEn?.toDate() ?? new Date()
    };
  }
}
