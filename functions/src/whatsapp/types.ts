// WhatsApp Business Cloud API webhook payload — minimal subset we consume.
// Full reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
//
// Make.com is expected to forward the raw payload from Meta unchanged. If a
// Make.com module flattens or reshapes it, parseWebhookPayload() will fail
// validation and the function returns 400.

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}

export interface WhatsAppChange {
  field?: string;
  value?: WhatsAppChangeValue;
}

export interface WhatsAppChangeValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: WhatsAppContactProfile[];
  messages?: WhatsAppIncomingMessage[];
}

export interface WhatsAppContactProfile {
  wa_id?: string;
  profile?: { name?: string };
}

export interface WhatsAppIncomingMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
}

// Internal normalized form passed to the writer. We only persist the contact
// itself (phone, name, optionally location) — message content is intentionally
// dropped to reduce Make.com op cost and Firestore storage.
export interface ParsedContact {
  fromPhone: string;
  profileName: string;
  location: { lat: number; lng: number } | null;
}
