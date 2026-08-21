# Atelier Fleet — WhatsApp AI sales agent

Single-tenant admin + webhook service for a luxury car rental business. Integration keys are entered in `/admin/settings/integrations`, encrypted, and stored in Postgres. There is no demo fleet and no mocked WhatsApp / Claude / Stripe responses.

**Production domain:** https://carrental.myflynai.com

## How secrets and files are stored

| Kind | Where |
|------|--------|
| WhatsApp / Claude / Stripe keys | Encrypted in Postgres (`AES-256-GCM` via `ENCRYPTION_KEY`) |
| Session / encryption bootstrap | Vercel (or local) env: `ENCRYPTION_KEY`, `SESSION_SECRET` |
| Vehicle photos | **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (preferred), else S3 env, else local `public/uploads` |
| Photo → WhatsApp | Worker job downloads Blob URL and uploads to Meta `/media`, caches `mediaIds` |

## Bootstrap env

Copy `.env.example` to `.env`, then:

```bash
npm run generate-keys
```

Paste `ENCRYPTION_KEY` and `SESSION_SECRET` into `.env`. Leave WhatsApp, Anthropic, and Stripe keys out of `.env`.

On **Vercel**, also set:

- `APP_BASE_URL=https://carrental.myflynai.com`
- `DATABASE_URL` / `REDIS_URL` (managed Postgres + Redis)
- `BLOB_READ_WRITE_TOKEN` — usually auto-added when you connect a Blob store
- Same `ENCRYPTION_KEY` / `SESSION_SECRET` on the **worker** host

Postgres for local Docker is on **port 5433** (avoids clashing with local Postgres on 5432).

## Local run

```bash
docker compose up postgres redis -d
npx prisma migrate deploy
npx prisma db seed
npm run dev
npm run worker
```

Open http://localhost:3000/admin — for local webhook tests, temporarily set `APP_BASE_URL` to your tunnel URL.

## Production go-live

1. Deploy app to Vercel (domain `carrental.myflynai.com`).
2. Run a long-lived **worker** (`npm run worker`) against the same `DATABASE_URL` + `REDIS_URL` (Docker Compose `worker` service, Railway, Fly, etc.). Vercel alone cannot run BullMQ.
3. Complete `/admin/setup` or Integrations (WhatsApp, Claude, Stripe).
4. In Meta: webhook `https://carrental.myflynai.com/api/webhooks/whatsapp`
5. In Stripe: webhook `https://carrental.myflynai.com/api/webhooks/stripe`
6. Add fleet + photos (Blob → queued Meta media upload).
7. Walk `/admin/go-live` and run a real UAT conversation.

Health: `GET https://carrental.myflynai.com/api/health`

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

## Full stack (local Docker)

```bash
docker compose up --build
```
