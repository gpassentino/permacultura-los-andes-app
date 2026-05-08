import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { normalizePhone } from '../lib/phone';
import type { ParsedMessage } from './types';

export interface WriteResult {
  wamid: string;
  contactId: string;
  action: 'created' | 'updated';
}

// Defaults applied to a new auto-created contact. Mirrors the schema in
// src/app/shared/models/contacto.model.ts. lastMessageAt / lastSyncAt are set
// via FieldValue.serverTimestamp() in the batch.
const NEW_CONTACT_DEFAULTS = {
  whatsappLabel: 'NM',
  status: 'nuevo_mensaje',
  businessTypes: ['general'],
  location: {},
  kanbanCardIds: [] as string[],
  notas: ''
};

export async function processMessage(msg: ParsedMessage): Promise<WriteResult> {
  const db = getFirestore();
  const normalized = normalizePhone(msg.fromPhone);
  if (!normalized) {
    throw new Error(`unable to normalize phone: ${msg.fromPhone}`);
  }

  const contactsCol = db.collection('contacts');
  const existing = await contactsCol.where('normalizedPhone', '==', normalized).limit(1).get();

  let contactRef;
  let action: 'created' | 'updated';

  if (existing.empty) {
    contactRef = contactsCol.doc();
    action = 'created';
  } else {
    contactRef = existing.docs[0].ref;
    action = 'updated';
  }

  const messageRef = contactRef.collection('messages').doc(msg.wamid);
  const batch = db.batch();

  if (action === 'created') {
    batch.set(contactRef, {
      ...NEW_CONTACT_DEFAULTS,
      phone: msg.fromPhone,
      normalizedPhone: normalized,
      name: msg.profileName || msg.fromPhone,
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSyncAt: FieldValue.serverTimestamp()
    });
  } else {
    const parentUpdate: Record<string, unknown> = {
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSyncAt: FieldValue.serverTimestamp()
    };
    if (msg.location) {
      parentUpdate['location.coordinates'] = msg.location;
    }
    batch.update(contactRef, parentUpdate);
  }

  // For new contacts, fold location into the initial set() so we don't issue
  // a second update for the same doc.
  if (action === 'created' && msg.location) {
    batch.update(contactRef, { 'location.coordinates': msg.location });
  }

  // setDoc with wamid as the doc ID makes Make.com retries idempotent —
  // a re-delivered message simply overwrites the same doc with identical data.
  batch.set(messageRef, {
    text: msg.text,
    timestamp: Timestamp.fromDate(msg.timestamp),
    fromContact: true,
    messageType: msg.messageType,
    mediaUrl: msg.mediaUrl,
    wamid: msg.wamid
  });

  await batch.commit();

  logger.info('whatsapp.message.processed', {
    wamid: msg.wamid,
    contactId: contactRef.id,
    action,
    messageType: msg.messageType,
    hasLocation: !!msg.location
  });

  return { wamid: msg.wamid, contactId: contactRef.id, action };
}
