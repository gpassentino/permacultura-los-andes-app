import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore, collection, collectionData, docData,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp, query, orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import {
  Contacto, FirestoreContacto,
  WhatsAppMessage, FirestoreWhatsAppMessage
} from '../shared/models/contacto.model';

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
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'contacts', id), {
        ...this.toFirestore(updates),
        lastSyncAt: serverTimestamp()
      })
    );
  }

  async deleteContacto(id: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'contacts', id))
    );
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
   * Phase 2: will auto-create a Kanban card in "Contacto Inicial".
   */
  async onLeadPaisajismoCreated(_contactId: string): Promise<void> {
    // TODO (Phase 2): create Kanban card and store kanbanCardId on contact
  }

  /**
   * Called when Kanban card moves to "Presupuesto Aprobado".
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
    return result;
  }

  private fromFirestore(data: FirestoreContacto): Contacto {
    return {
      id:              data.id,
      phone:           data.phone ?? '',
      name:            data.name  ?? '',
      whatsappLabel:   data.whatsappLabel  ?? 'NM',
      businessTypes:   data.businessTypes  ?? [],
      status:          data.status         ?? 'nuevo_mensaje',
      location:        data.location       ?? {},
      kanbanCardId:    data.kanbanCardId,
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
