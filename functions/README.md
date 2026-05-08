# Cloud Functions — Permacultura Los Andes

Firebase Cloud Functions backing the Angular app. Currently hosts the WhatsApp
ingestion endpoint that bridges Meta's WhatsApp Business Cloud API → Make.com
→ Firestore.

## Structure

```
functions/
  src/
    index.ts                # function exports
    lib/phone.ts            # normalizePhone() — kept in sync with src/app/shared/utils/phone.ts
    whatsapp/
      types.ts              # WhatsApp Cloud API payload shapes
      parse.ts              # raw payload → ParsedMessage[]
      writer.ts             # upsert contact + write message subcollection
      webhook.ts            # HTTPS entry point (whatsappWebhook)
```

## Local development

```bash
cd functions
npm ci
npm run build       # tsc to lib/
npm test            # vitest
npm run serve       # firebase emulators:start --only functions
```

## Deploy

Production deploys happen automatically from `main` via GitHub Actions
(`.github/workflows/firebase-hosting-merge.yml`). Manual deploy:

```bash
cd functions && npm run deploy
```

## Endpoint: `whatsappWebhook`

HTTPS POST endpoint that ingests a WhatsApp Business Cloud API webhook payload,
upserts the matching `contacts/*` doc by normalized phone (E.164), and writes
the message into the `contacts/{contactId}/messages/{wamid}` subcollection.

- Region: `us-central1`
- URL (after first deploy): `https://us-central1-permacultura-los-andes.cloudfunctions.net/whatsappWebhook`
- Method: `POST` only (other methods → 405)
- Auth: shared secret in `x-webhook-secret` header (timing-safe compared)

### Status codes

| Code | Meaning                                                                                   |
|------|-------------------------------------------------------------------------------------------|
| 200  | Processed successfully (or payload contained no messages — e.g. status-only updates)      |
| 400  | Malformed payload — `entry[]` missing or wrong shape                                      |
| 401  | Missing or incorrect `x-webhook-secret` header                                            |
| 405  | Method other than POST                                                                    |
| 500  | Every message in the payload failed to write (partial failures still return 200)          |

### Idempotency

Each message is stored at `contacts/{contactId}/messages/{wamid}`. If Make.com
retries, the same `wamid` overwrites the same doc with identical data — no
duplicates.

### New contact defaults

When the incoming phone doesn't match any existing contact, a new doc is
created with:

- `whatsappLabel: 'NM'`
- `status: 'nuevo_mensaje'`
- `businessTypes: ['general']`
- `name`: pulled from `value.contacts[].profile.name` (falls back to the phone)
- `kanbanCardIds: []`, empty `location`, empty `notas`

The user can refine these in the Contactos UI.

## Setting the webhook secret

The shared secret lives in Google Secret Manager under
`WHATSAPP_WEBHOOK_SECRET`. Set or rotate it via:

```bash
# generate a strong random secret
openssl rand -hex 32 | firebase functions:secrets:set WHATSAPP_WEBHOOK_SECRET
```

Then redeploy so the function picks up the new version:

```bash
cd functions && npm run deploy
```

## Make.com scenario setup

1. **Trigger module**: WhatsApp Business → Watch Events (or a generic webhook
   that Meta posts directly to Make.com).
2. **HTTP module**: Make a request
   - URL: the deployed endpoint above
   - Method: POST
   - Headers: `x-webhook-secret: <the secret>`, `Content-Type: application/json`
   - Body: pass the **raw payload** from Meta unchanged. Don't flatten or
     reshape — `parse.ts` expects the standard `entry[].changes[].value.{messages, contacts}`
     structure.
3. **Error handler**: configure the Make.com scenario to retry on 5xx (the
   default 3-attempt retry is fine — `wamid` deduplication makes retries safe).
   Do NOT retry on 4xx; those are permanent (bad secret or malformed payload).

## Out of scope (deferred to follow-up PRs)

The TODO.md Section 1 list includes several items handled outside this
endpoint:

- WhatsApp **label changes** (NM/IN/LD/CL/SR + business type) — not exposed
  by the Cloud API messages webhook. Will need a separate Make.com scenario
  + endpoint when label automation is wired up.
- `onLeadPaisajismoCreated` — auto-create a Kanban card when label flips to
  `LD | Paisajismo`. Depends on the label-change endpoint.
- `Cliente.fechaUltimoContacto` fan-out — push `lastMessageAt` updates from
  the contact onto every linked Kanban card.
