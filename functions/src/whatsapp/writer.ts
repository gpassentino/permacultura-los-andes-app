import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { normalizePhone } from '../lib/phone';
import type { ParsedContact } from './types';

export interface WriteResult {
  fromPhone: string;
  contactId: string;
  action: 'created' | 'updated';
}

// Defaults applied to a new auto-created contact. Mirrors the schema in
// src/app/shared/models/contacto.model.ts.
const NEW_CONTACT_DEFAULTS = {
  status: 'interesado',
  businessTypes: ['general'],
  location: {},
  kanbanCardIds: [] as string[],
  notas: ''
};

export async function processContact(c: ParsedContact): Promise<WriteResult> {
  const db = getFirestore();
  const normalized = normalizePhone(c.fromPhone);
  if (!normalized) {
    throw new Error(`unable to normalize phone: ${c.fromPhone}`);
  }

  const contactsCol = db.collection('contacts');
  const existing = await contactsCol.where('normalizedPhone', '==', normalized).limit(1).get();

  let contactRef;
  let action: 'created' | 'updated';

  if (existing.empty) {
    contactRef = contactsCol.doc();
    action = 'created';
    await contactRef.set({
      ...NEW_CONTACT_DEFAULTS,
      phone: c.fromPhone,
      normalizedPhone: normalized,
      name: c.profileName || c.fromPhone,
      createdAt: FieldValue.serverTimestamp(),
      ...(c.location ? { location: { coordinates: c.location } } : {})
    });
  } else {
    contactRef = existing.docs[0].ref;
    action = 'updated';
    if (c.location) {
      await contactRef.update({ 'location.coordinates': c.location });
    }
  }

  logger.info('whatsapp.contact.processed', {
    contactId: contactRef.id,
    action,
    hasLocation: !!c.location
  });

  return { fromPhone: c.fromPhone, contactId: contactRef.id, action };
}
