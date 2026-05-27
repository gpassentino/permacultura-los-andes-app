import type {
  WhatsAppWebhookPayload,
  WhatsAppContactProfile,
  WhatsAppIncomingMessage,
  ParsedContact
} from './types';

export class MalformedPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedPayloadError';
  }
}

export function parseWebhookPayload(payload: unknown): ParsedContact[] {
  if (!payload || typeof payload !== 'object') {
    throw new MalformedPayloadError('payload is not an object');
  }
  const p = payload as WhatsAppWebhookPayload;
  if (!Array.isArray(p.entry)) {
    throw new MalformedPayloadError('payload.entry must be an array');
  }

  const out: ParsedContact[] = [];
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
): ParsedContact | null {
  if (!m.from) return null;

  const profileName = profiles.find((c) => c.wa_id === m.from)?.profile?.name ?? '';

  let location: ParsedContact['location'] = null;
  if (m.type === 'location') {
    const lat = m.location?.latitude;
    const lng = m.location?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      location = { lat, lng };
    }
  }

  return {
    fromPhone: m.from,
    profileName,
    location
  };
}
