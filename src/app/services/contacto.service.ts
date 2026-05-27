import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp, query, orderBy, where, getDocs, limit,
  writeBatch, collectionGroup
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import { Contacto, FirestoreContacto } from '../shared/models/contacto.model';
import { normalizePhone } from '../shared/utils/phone';

/**
 * Thrown by ContactoService.deleteContacto when the contact still has linked
 * Cliente or Participante records. The caller should display the counts to
 * the user and prompt them to detach the links first.
 */
export class ContactoLinkedError extends Error {
  constructor(public counts: { clientes: number; participantes: number }) {
    super(`Contacto tiene ${counts.clientes} tarjeta(s) y ${counts.participantes} participante(s) vinculado(s)`);
    this.name = 'ContactoLinkedError';
  }
}

@Injectable({ providedIn: 'root' })
export class ContactoService {
  private firestore = inject(Firestore);
  private auth      = inject(Auth);
  private injector  = inject(Injector);

  private col = collection(this.firestore, 'contacts');

  // ── Contactos CRUD ──────────────────────────────────────────────────────────

  getContactos(): Observable<Contacto[]> {
    const q = query(this.col, orderBy('name', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreContacto[]).map(d => this.fromFirestore(d)))
    );
  }

  getContacto(id: string): Observable<Contacto | undefined> {
    return docData(doc(this.firestore, 'contacts', id), { idField: 'id' }).pipe(
      map(d => d ? this.fromFirestore(d as FirestoreContacto) : undefined)
    );
  }

  async addContacto(data: Partial<Contacto>): Promise<string> {
    const ref = await runInInjectionContext(this.injector, () =>
      addDoc(this.col, {
        ...this.toFirestore(data),
        createdAt: serverTimestamp()
      })
    );
    return ref.id;
  }

  async updateContacto(id: string, updates: Partial<Contacto>): Promise<void> {
    const nameChanged  = Object.prototype.hasOwnProperty.call(updates, 'name');
    const phoneChanged = Object.prototype.hasOwnProperty.call(updates, 'phone');

    await runInInjectionContext(this.injector, async () => {
      // Always update the canonical contact first
      await updateDoc(doc(this.firestore, 'contacts', id), this.toFirestore(updates));

      if (!nameChanged && !phoneChanged) return;

      // Fan out to denormalized snapshots on linked Cliente + Participante docs
      const batch = writeBatch(this.firestore);

      // Linked Kanban cards
      const clientesQ = query(
        collection(this.firestore, 'clientes'),
        where('contactoId', '==', id)
      );
      const clientesSnap = await getDocs(clientesQ);
      for (const docSnap of clientesSnap.docs) {
        const patch: Record<string, unknown> = {};
        if (nameChanged)  patch['nombre']   = updates.name;
        if (phoneChanged) patch['whatsapp'] = updates.phone;
        batch.update(docSnap.ref, patch);
      }

      // Linked Academia participantes (collectionGroup across all talleres)
      const partsQ = query(
        collectionGroup(this.firestore, 'participantes'),
        where('contactoId', '==', id)
      );
      const partsSnap = await getDocs(partsQ);
      for (const docSnap of partsSnap.docs) {
        const patch: Record<string, unknown> = {};
        if (nameChanged)  patch['nombreCompleto'] = updates.name;
        if (phoneChanged) patch['whatsapp']       = updates.phone;
        batch.update(docSnap.ref, patch);
      }

      await batch.commit();
    });
  }

  /**
   * Counts linked Cliente (Kanban) cards and Participante (Academia) records
   * for this contact. Used to block deletion when a contact is in use.
   */
  async countLinkedRecords(id: string): Promise<{ clientes: number; participantes: number }> {
    return await runInInjectionContext(this.injector, async () => {
      const clientesQ = query(
        collection(this.firestore, 'clientes'),
        where('contactoId', '==', id)
      );
      const partsQ = query(
        collectionGroup(this.firestore, 'participantes'),
        where('contactoId', '==', id)
      );
      const [clientesSnap, partsSnap] = await Promise.all([
        getDocs(clientesQ),
        getDocs(partsQ)
      ]);
      return { clientes: clientesSnap.size, participantes: partsSnap.size };
    });
  }

  /**
   * Deletes a contact. Throws if any linked Cliente or Participante exists —
   * the user must detach those first (delete the Kanban card / remove from
   * the taller). This prevents orphaning denormalized snapshots.
   */
  async deleteContacto(id: string): Promise<void> {
    const counts = await this.countLinkedRecords(id);
    if (counts.clientes > 0 || counts.participantes > 0) {
      throw new ContactoLinkedError(counts);
    }
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'contacts', id))
    );
  }

  /**
   * Find a contact by phone number. Normalizes the input first, so callers
   * can pass any reasonable format ("300 123 4567", "+573001234567", etc.).
   * Returns undefined if no match. Used by the contact form (block-on-submit
   * duplicate check).
   */
  async findByPhone(phone: string): Promise<Contacto | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    const q = query(this.col, where('normalizedPhone', '==', normalized), limit(1));
    const snap = await runInInjectionContext(this.injector, () => getDocs(q));
    if (snap.empty) return undefined;
    const docSnap = snap.docs[0];
    return this.fromFirestore({ id: docSnap.id, ...docSnap.data() } as FirestoreContacto);
  }

  // ── Firestore conversion ────────────────────────────────────────────────────

  private toFirestore(data: Partial<Contacto>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const skip = new Set(['id', 'createdAt']);
    for (const [key, value] of Object.entries(data)) {
      if (skip.has(key)) continue;
      if (value instanceof Date) {
        result[key] = Timestamp.fromDate(value);
      } else {
        result[key] = value;
      }
    }
    if (typeof data.phone === 'string') {
      result['normalizedPhone'] = normalizePhone(data.phone);
    }
    return result;
  }

  private fromFirestore(data: FirestoreContacto): Contacto {
    return {
      id:              data.id,
      phone:           data.phone ?? '',
      normalizedPhone: data.normalizedPhone ?? normalizePhone(data.phone ?? ''),
      name:            data.name  ?? '',
      businessTypes:   data.businessTypes  ?? [],
      status:          data.status         ?? 'interesado',
      location:        data.location       ?? {},
      kanbanCardIds:   data.kanbanCardIds  ?? [],
      academiaHistory: data.academiaHistory,
      notas:           data.notas          ?? '',
      createdAt:       data.createdAt?.toDate() ?? new Date()
    };
  }
}
