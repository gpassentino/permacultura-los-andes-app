import { onRequest, type Request } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import type { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { parseWebhookPayload, MalformedPayloadError } from './parse';
import { processContact } from './writer';

const WHATSAPP_WEBHOOK_SECRET = defineSecret('WHATSAPP_WEBHOOK_SECRET');

export const whatsappWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [WHATSAPP_WEBHOOK_SECRET],
    cors: false,
    invoker: 'public'
  },
  async (req: Request, res: Response) => {
    logger.info('whatsapp.webhook.received', {
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      hasSecretHeader: !!req.get('x-webhook-secret'),
      contentType: req.get('content-type'),
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null
    });

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    if (!verifySecret(req, WHATSAPP_WEBHOOK_SECRET.value())) {
      logger.warn('whatsapp.webhook.unauthorized', { ip: req.ip });
      res.status(401).send('Unauthorized');
      return;
    }

    let contacts;
    try {
      contacts = parseWebhookPayload(req.body);
    } catch (err) {
      if (err instanceof MalformedPayloadError) {
        logger.warn('whatsapp.webhook.malformed', {
          reason: err.message,
          bodyPreview: JSON.stringify(req.body).slice(0, 500)
        });
        res.status(400).send(`Bad Request: ${err.message}`);
        return;
      }
      throw err;
    }

    if (contacts.length === 0) {
      // Status updates, read receipts, etc. — we acknowledge but do nothing.
      logger.info('whatsapp.webhook.no_contacts', {
        bodyPreview: JSON.stringify(req.body).slice(0, 500)
      });
      res.status(200).send('OK');
      return;
    }

    logger.info('whatsapp.webhook.parsed', {
      contactCount: contacts.length,
      fromPhones: contacts.map((c) => c.fromPhone)
    });

    const results = [];
    const errors: Array<{ fromPhone: string; error: string }> = [];
    for (const c of contacts) {
      try {
        const result = await processContact(c);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('whatsapp.contact.failed', { fromPhone: c.fromPhone, error: message });
        errors.push({ fromPhone: c.fromPhone, error: message });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      res.status(500).json({ ok: false, errors });
      return;
    }

    res.status(200).json({ ok: true, processed: results.length, errors });
  }
);

function verifySecret(req: Request, expected: string): boolean {
  const provided = (req.get('x-webhook-secret') ?? '').trim();
  const trimmed = expected.trim();
  if (!provided || !trimmed) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(trimmed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
