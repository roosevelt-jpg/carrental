# Atelier Fleet — WhatsApp AI sales agent

Single-tenant admin + webhook service for a luxury car rental business. Integration keys are entered in `/admin/settings/integrations`, encrypted, and stored in Postgres. There is no demo fleet and no mocked WhatsApp / Claude / Stripe responses.

## Bootstrap env

Copy `.env.example` to `.env`, then generate secrets:

```bash
npm run generate-keys
```

Paste `ENCRYPTION_KEY` and `SESSION_SECRET` into `.env`. Leave WhatsApp, Anthropic, and Stripe keys out of `.env` — they belong in the admin UI.

Postgres for local Docker is on **port 5433** (to avoid clashing with a local Postgres on 5432).

## Local run

```bash
docker compose up postgres redis -d
npx prisma migrate deploy
npx prisma db seed
npm run dev
npm run worker
```

Open http://localhost:3000/admin

## When you are ready to add keys + test

1. Complete `/admin/setup` or `/admin/settings/integrations` (WhatsApp, Claude, Stripe).
2. Add fleet, policies, photos, availability.
3. Mark Meta message templates on `/admin/settings/message-templates`.
4. Expose the app publicly (ngrok / deploy) and set `APP_BASE_URL`.
5. In Meta, set webhook to `{APP_BASE_URL}/api/webhooks/whatsapp`.
6. In Stripe, set webhook to `{APP_BASE_URL}/api/webhooks/stripe`.
7. Walk `/admin/go-live` and run a real UAT conversation.

Health check: `GET /api/health`

## Useful admin routes

- `/admin/go-live` — launch checklist
- `/admin/digest` — 7-day patterns
- `/admin/settings/message-templates` — Meta template approval tracking
- `/admin/settings/audit-log` — change history
- `/admin/settings/fine-tuning` — readiness gates (human-curated only)
- `/admin/fleet/[id]` — edit vehicle, photos, availability

## Ops scripts

```bash
npm test
npm run reencrypt-credentials   # OLD_ENCRYPTION_KEY + ENCRYPTION_KEY required
```

## Full stack

```bash
docker compose up --build
```
