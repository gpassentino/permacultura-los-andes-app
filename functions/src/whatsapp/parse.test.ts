import { describe, it, expect } from 'vitest';
import { parseWebhookPayload, MalformedPayloadError } from './parse';

function textPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '57300', phone_number_id: 'pid' },
              contacts: [{ wa_id: '573001234567', profile: { name: 'Ana López' } }],
              messages: [
                {
                  id: 'wamid.ABC123',
                  from: '573001234567',
                  timestamp: '1715000000',
                  type: 'text',
                  text: { body: 'Hola, quiero info' },
                  ...overrides
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

describe('parseWebhookPayload', () => {
  it('throws on null/non-object', () => {
    expect(() => parseWebhookPayload(null)).toThrow(MalformedPayloadError);
    expect(() => parseWebhookPayload('nope')).toThrow(MalformedPayloadError);
  });

  it('throws when entry is missing or not an array', () => {
    expect(() => parseWebhookPayload({})).toThrow(MalformedPayloadError);
    expect(() => parseWebhookPayload({ entry: 'x' })).toThrow(MalformedPayloadError);
  });

  it('returns empty array for status-only payloads (no messages)', () => {
    const payload = {
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.S1', status: 'delivered' }] } }] }]
    };
    expect(parseWebhookPayload(payload)).toEqual([]);
  });

  it('extracts contact info and pulls profile name from contacts[]', () => {
    const result = parseWebhookPayload(textPayload());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      fromPhone: '573001234567',
      profileName: 'Ana López',
      location: null
    });
  });

  it('extracts lat/lng from a location message', () => {
    const result = parseWebhookPayload(
      textPayload({ type: 'location', text: undefined, location: { latitude: 6.15, longitude: -75.4, name: 'Casa' } })
    );
    expect(result[0].location).toEqual({ lat: 6.15, lng: -75.4 });
  });

  it('ignores image captions and other message content', () => {
    const result = parseWebhookPayload(
      textPayload({ type: 'image', text: undefined, image: { id: 'media-1', caption: 'foto del jardín' } })
    );
    // Only the contact info survives — no text, no mediaUrl
    expect(result[0]).toEqual({
      fromPhone: '573001234567',
      profileName: 'Ana López',
      location: null
    });
  });

  it('skips messages missing from', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.X', timestamp: '1' }]
              }
            }
          ]
        }
      ]
    };
    expect(parseWebhookPayload(payload)).toEqual([]);
  });
});
