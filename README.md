# WhatsApp AI sales agent platform

Single-tenant admin + webhook service for a luxury car rental business. Integration keys are entered in `/admin/settings/integrations`, encrypted, and stored in Postgres. There is no demo fleet and no mocked WhatsApp / Claude / Stripe responses.

**Production domain:** https://carrental.myflynai.com

## How secrets and files are stored

| Kind | Where |
|------|--------|
| WhatsApp / Claude / Stripe keys | Encrypted in Postgres (`AES-256-GCM` via `ENCRYPTION_KEY`) |
| Session / encryption bootstrap | Deployment env: `ENCRYPTION_KEY`, `SESSION_SECRET` |
| Vehicle photos | S3-compatible object storage; local `public/uploads` only during development |
| Photo → WhatsApp | Worker downloads the S3 URL, uploads to Meta `/media`, and caches `mediaIds` |

## Bootstrap env

Copy `.env.example` to `.env`, then:

```bash
npm run generate-keys
```

Paste `ENCRYPTION_KEY` and `SESSION_SECRET` into `.env`. Leave WhatsApp, Anthropic, and Stripe keys out of `.env`.

For the production container, set:

- `APP_BASE_URL=https://carrental.myflynai.com`
- `DATABASE_URL` / `REDIS_URL` (managed Postgres + Redis)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`
- The same `ENCRYPTION_KEY` / `SESSION_SECRET` for the app and worker processes

Quote-hold and data-retention controls are edited in the admin CMS, not environment variables.

Postgres for local Docker is on **port 5433** (avoids clashing with local Postgres on 5432).

## Local run

```bash
docker compose up postgres redis -d
npx prisma migrate deploy
npx prisma db seed
npm run encrypt-existing-pii
npm run dev
npm run build:worker
npm run worker
```

Open http://localhost:3000/admin — for local webhook tests, temporarily set `APP_BASE_URL` to your tunnel URL.

`encrypt-existing-pii` is idempotent and is required once when upgrading a
deployment that already contains customer or conversation rows. New databases
start empty and encrypt sensitive content from the first webhook event.

## Production go-live

1. Deploy the Docker image through Docker Compose, Railway, Fly.io, or another container host.
2. Run the included long-lived app and worker processes against the same PostgreSQL and Redis services.
3. Complete `/admin/setup` or Integrations (WhatsApp, Claude, Stripe).
4. In Meta: webhook `https://carrental.myflynai.com/api/webhooks/whatsapp`
5. In Stripe: webhook `https://carrental.myflynai.com/api/webhooks/stripe`
6. Add fleet + photos (S3 → queued Meta media upload).
7. Walk `/admin/go-live` and run a real UAT conversation.
8. Open `/admin/content`, complete the business/brand/AI content, preview the draft, and publish it.
9. Open Message Templates, author real wording and review samples, then use **Submit to Meta**. The access token needs `whatsapp_business_management` as well as messaging permission. Subscribe the WABA webhook to template status updates; the dashboard also supports manual status sync.
10. Wait for Meta approval. Go-live requires all customer and owner operational templates to be approved.
11. Run `REQUIRE_GO_LIVE_EVIDENCE=1 npm run test:evidence` after real Meta,
    Stripe, escalation, booking, and load/UAT activity. The evidence suite reads
    recorded provider and latency results and never substitutes mocked APIs.

The required templates are booking confirmation, payment reminder, re-engagement,
owner escalation, owner reminder, owner booking, and weekly digest. Production
database URLs must require TLS. The worker publishes a heartbeat consumed by the
health endpoint and go-live checklist.

Health: `GET https://carrental.myflynai.com/api/health`

## Useful admin routes

- `/admin/go-live` — launch checklist
- `/admin/digest` — 7-day patterns
- `/admin/content` — business profile, branding, public site, AI playbook, FAQs, and knowledge
- `/admin/settings/message-templates` — edit, submit/resubmit, and sync Meta templates
- `/admin/settings/audit-log` — change history
- `/admin/settings/fine-tuning` — readiness gates (human-curated only)
- `/admin/fleet/[id]` — edit vehicle, photos, availability

## CMS publishing behavior

- Content Studio keeps an editable working copy and an immutable live snapshot. **Save draft** never changes the public site; **Publish** atomically replaces the live snapshot.
- Signed-in staff see the draft at `/`; anonymous visitors see the latest published snapshot or a coming-soon page before first publication.
- Active FAQs appear publicly and are also supplied to the agent. Active knowledge entries are agent-only verified content.
- The AI tone and sales playbook are CMS-driven, while payment verification, availability checks, policy retrieval, and escalation constraints remain enforced in code.
- Business-neutral template shells are created when the template editor opens. The owner authors all wording and Meta samples. Editing an approved template returns it to local draft status until Meta reviews the submitted update.

## Ops scripts

```bash
npm test
npm run worker:dev             # development worker without a production build
npm run reencrypt-credentials   # OLD_ENCRYPTION_KEY + ENCRYPTION_KEY required
```

## Full stack (local Docker)

```bash
docker compose up --build
```
