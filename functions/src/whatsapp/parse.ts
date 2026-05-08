import type {
  WhatsAppWebhookPayload,
  WhatsAppContactProfile,
  WhatsAppIncomingMessage,
  ParsedMessage
} from './types';

export class MalformedPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedPayloadError';
  }
}

const SUPPORTED_TYPES = new Set(['text', 'image', 'location', 'document']);

export function parseWebhookPayload(payload: unknown): ParsedMessage[] {
  if (!payload || typeof payload !== 'object') {
    throw new MalformedPayloadError('payload is not an object');
  }
  const p = payload as WhatsAppWebhookPayload;
  if (!Array.isArray(p.entry)) {
    throw new MalformedPayloadError('payload.entry must be an array');
  }

  const out: ParsedMessage[] = [];
  for (const entry of p.entry) {
    if (!Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (!value) continue;
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const profiles = Array.isArray(value.contacts) ? value.contacts : [];
      for (const m of messages) {
        const parsed = parseMessage(m, profiles);
        if (parsed) out.push(parsed);
      }
    }
  }
  return out;
}

function parseMessage(
  m: WhatsAppIncomingMessage,
  profiles: WhatsAppContactProfile[]
): ParsedMessage | null {
  if (!m.id || !m.from) return null;
  const rawType = m.type ?? 'text';
  const type = SUPPORTED_TYPES.has(rawType) ? (rawType as ParsedMessage['messageType']) : 'text';

  const profileName = profiles.find((c) => c.wa_id === m.from)?.profile?.name ?? '';
  const tsSeconds = m.timestamp ? Number(m.timestamp) : NaN;
  const timestamp = Number.isFinite(tsSeconds) ? new Date(tsSeconds * 1000) : new Date();

  let text = '';
  let mediaUrl: string | null = null;
  let location: ParsedMessage['location'] = null;

  switch (type) {
    case 'text':
      text = m.text?.body ?? '';
      break;
    case 'image':
      text = m.image?.caption ?? '';
      mediaUrl = m.image?.id ? `whatsapp-media:${m.image.id}` : null;
      break;
    case 'document':
      text = m.document?.caption ?? m.document?.filename ?? '';
      mediaUrl = m.document?.id ? `whatsapp-media:${m.document.id}` : null;
      break;
    case 'location': {
      const lat = m.location?.latitude;
      const lng = m.location?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        location = { lat, lng };
        text = m.location?.name ?? m.location?.address ?? '';
      }
      break;
    }
  }

  return {
    wamid: m.id,
    fromPhone: m.from,
    profileName,
    timestamp,
    messageType: type,
    text,
    mediaUrl,
    location
  };
}
