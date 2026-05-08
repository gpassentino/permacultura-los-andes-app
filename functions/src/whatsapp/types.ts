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

export type WhatsAppMessageType = 'text' | 'image' | 'location' | 'document' | string;

export interface WhatsAppIncomingMessage {
  id?: string;
  from?: string;
  timestamp?: string; // unix seconds as a string
  type?: WhatsAppMessageType;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
}

// Internal normalized form passed to the writer.
export interface ParsedMessage {
  wamid: string;
  fromPhone: string;
  profileName: string;
  timestamp: Date;
  messageType: 'text' | 'image' | 'location' | 'document';
  text: string;
  mediaUrl: string | null;
  location: { lat: number; lng: number } | null;
}
