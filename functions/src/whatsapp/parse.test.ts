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

  it('parses a text message and pulls profile name from contacts[]', () => {
    const result = parseWebhookPayload(textPayload());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      wamid: 'wamid.ABC123',
      fromPhone: '573001234567',
      profileName: 'Ana López',
      messageType: 'text',
      text: 'Hola, quiero info',
      mediaUrl: null,
      location: null
    });
    expect(result[0].timestamp.getTime()).toBe(1715000000 * 1000);
  });

  it('parses a location message with lat/lng', () => {
    const result = parseWebhookPayload(
      textPayload({ type: 'location', text: undefined, location: { latitude: 6.15, longitude: -75.4, name: 'Casa' } })
    );
    expect(result[0].messageType).toBe('location');
    expect(result[0].location).toEqual({ lat: 6.15, lng: -75.4 });
    expect(result[0].text).toBe('Casa');
  });

  it('parses an image message with caption', () => {
    const result = parseWebhookPayload(
      textPayload({ type: 'image', text: undefined, image: { id: 'media-1', caption: 'foto del jardín' } })
    );
    expect(result[0].messageType).toBe('image');
    expect(result[0].text).toBe('foto del jardín');
    expect(result[0].mediaUrl).toBe('whatsapp-media:media-1');
  });

  it('skips messages missing id or from', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.X', timestamp: '1' }, { from: '573001', timestamp: '1' }]
              }
            }
          ]
        }
      ]
    };
    expect(parseWebhookPayload(payload)).toEqual([]);
  });

  it('falls back to current time when timestamp is invalid', () => {
    const before = Date.now();
    const result = parseWebhookPayload(textPayload({ timestamp: 'not-a-number' }));
    expect(result[0].timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('treats unknown message types as text', () => {
    const result = parseWebhookPayload(textPayload({ type: 'audio' }));
    expect(result[0].messageType).toBe('text');
  });
});
