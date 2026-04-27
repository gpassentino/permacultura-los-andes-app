import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp, query, orderBy, where, getDocs, limit,
  writeBatch, collectionGroup
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import {
  Contacto, FirestoreContacto,
  WhatsAppMessage, FirestoreWhatsAppMessage
} from '../shared/models/contacto.model';
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
    const q = query(this.col, orderBy('lastMessageAt', 'desc'));
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
        createdAt:     serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastSyncAt:    serverTimestamp()
      })
    );
    return ref.id;
  }

  async updateContacto(id: string, updates: Partial<Contacto>): Promise<void> {
    const nameChanged  = Object.prototype.hasOwnProperty.call(updates, 'name');
    const phoneChanged = Object.prototype.hasOwnProperty.call(updates, 'phone');

    await runInInjectionContext(this.injector, async () => {
      // Always update the canonical contact first
      await updateDoc(doc(this.firestore, 'contacts', id), {
        ...this.toFirestore(updates),
        lastSyncAt: serverTimestamp()
      });

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
   * Returns undefined if no match. Used by WhatsApp sync (upsert) and by the
   * contact form (block-on-submit duplicate check).
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

  // ── Message sub-collection ─────────────────────────────────────────────────

  getMessages(contactId: string): Observable<WhatsAppMessage[]> {
    const msgCol = collection(this.firestore, 'contacts', contactId, 'messages');
    const q = query(msgCol, orderBy('timestamp', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map(docs => (docs as FirestoreWhatsAppMessage[]).map(d => this.messageFromFirestore(d)))
    );
  }

  async addMessage(contactId: string, data: Partial<WhatsAppMessage>): Promise<void> {
    const msgCol = collection(this.firestore, 'contacts', contactId, 'messages');
    await runInInjectionContext(this.injector, () =>
      addDoc(msgCol, {
        text:        data.text ?? '',
        timestamp:   serverTimestamp(),
        fromContact: data.fromContact ?? false,
        messageType: data.messageType ?? 'text',
        mediaUrl:    data.mediaUrl ?? null
      })
    );
    // Update lastMessageAt on parent doc
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'contacts', contactId), {
        lastMessageAt: serverTimestamp()
      })
    );
  }

  // ── Integration hooks (Phase 2: WhatsApp / Kanban / Academia) ─────────────

  /**
   * Called when a contact's label becomes "LD | Paisajismo".
   * Phase 2: will auto-create a Kanban card in "Antes" (Visita Técnica by default).
   */
  async onLeadPaisajismoCreated(_contactId: string): Promise<void> {
    // TODO (Phase 2): create Kanban card and append to kanbanCardIds on contact
  }

  /**
   * Called when a Kanban card transitions to a paid stage (e.g. presupuesto aprobado).
   * Phase 2: will update contact status to "CL | Paisajismo".
   */
  async onKanbanPresupuestoAprobado(_contactId: string): Promise<void> {
    // TODO (Phase 2): sync status to contact
  }

  /**
   * Called when a taller is completed.
   * Phase 2: will push taller ID into contact.academiaHistory.completedTalleres.
   */
  async onTallerCompleted(_contactId: string, _tallerId: string): Promise<void> {
    // TODO (Phase 2): update academiaHistory
  }

  /**
   * Sync contacts from WhatsApp via Make.com webhook payload.
   * Phase 2: parses webhook body and upserts contacts.
   */
  async syncFromWebhook(_payload: unknown): Promise<void> {
    // TODO (Phase 2): parse Make.com payload and upsert contacts
  }

  // ── Firestore conversion ────────────────────────────────────────────────────

  private toFirestore(data: Partial<Contacto>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const skip = new Set(['id', 'createdAt', 'lastMessageAt', 'lastSyncAt']);
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
      whatsappLabel:   data.whatsappLabel  ?? 'NM',
      businessTypes:   data.businessTypes  ?? [],
      status:          data.status         ?? 'nuevo_mensaje',
      location:        data.location       ?? {},
      kanbanCardIds:   data.kanbanCardIds  ?? [],
      academiaHistory: data.academiaHistory,
      notas:           data.notas          ?? '',
      createdAt:       data.createdAt?.toDate()     ?? new Date(),
      lastMessageAt:   data.lastMessageAt?.toDate() ?? new Date(),
      lastSyncAt:      data.lastSyncAt?.toDate()    ?? new Date()
    };
  }

  private messageFromFirestore(data: FirestoreWhatsAppMessage): WhatsAppMessage {
    return {
      id:          data.id,
      text:        data.text        ?? '',
      timestamp:   data.timestamp?.toDate() ?? new Date(),
      fromContact: data.fromContact ?? true,
      messageType: data.messageType ?? 'text',
      mediaUrl:    data.mediaUrl
    };
  }
}
