# WhatsApp AI Sales Agent — Cursor Build Specification

**Product**: A deployment-ready, single-tenant WhatsApp sales agent platform for a luxury car rental business in Dubai. The business owner logs into an admin CMS, enters their own WhatsApp Business, Anthropic, and Stripe API keys on an **Integrations** page, populates their real fleet through the CMS, and the platform is live — no developer involvement, no demo data, no mocked responses anywhere.

This document is written to be handed directly to Cursor's agent as a build brief. It supersedes the original scope post it was derived from wherever the two disagree — it is more specific on purpose so an agent can execute against it without guessing.

---

## 0. Instructions to the building agent (read first)

Follow these rules for the entire build, not just the first pass:

1. **Never write mock, fake, or placeholder business data.** No sample vehicles, no sample customers, no "Toyota Demo Car" fixtures, no hardcoded prices anywhere in code, prompts, or seed scripts. The database starts empty of business data. The only seed data allowed is *structural* reference data listed in Section 14 (enum-like lookup rows the app needs to function, not business content).
2. **Never call a third-party API with a mocked/stubbed response as a permanent code path.** Every WhatsApp, Anthropic, and Stripe call goes to the real API using whatever key is currently configured (a test/sandbox key during development is fine — that's a real key, just a lower-stakes one — but do not build a "fake mode" toggle into the shipped product).
3. **All third-party credentials are configured through the admin UI (Section 6.5), not hardcoded and not required in `.env` at deploy time.** `.env` / platform env vars hold only the *bootstrap* secrets in Section 4.1 (database connection, encryption key, session secret). Nothing else third-party-specific belongs in an env file.
4. **Every fact the agent states to a customer (price, availability, spec, policy) must come from a tool call that reads the database, never from the system prompt or the model's own knowledge.** This is the anti-hallucination mechanism — treat it as an architectural constraint, not a prompt instruction. If you're tempted to bake a price or policy into a prompt string, stop — it belongs in a table, read via a tool.
5. **Default to escalation on uncertainty.** Any unhandled exception, any tool error, any conversation the agent can't confidently resolve within its defined tools/policies must escalate to the owner — never guess, never go silent.
6. Build in the phase order in Section 15. Each phase should be independently demoable against the real (test-mode) third-party APIs before moving to the next.
7. If a decision point in this document is marked `[DECISION NEEDED]`, do not invent an answer silently — surface it back to the user before proceeding on that specific piece.

---

## 1. Product definition & non-negotiables

- **Single-tenant.** One deployment = one business. No `organization_id`/tenant scoping anywhere — simplifies every table and every query. If this business later wants a second rental brand, that's a second deployment.
- **CMS-first.** The admin panel is not an afterthought bolted onto a backend — it *is* the way the business's fleet, pricing, policies, escalation rules, and integration keys get into the system. There is no other path to populate this data (no CSV-only import, no "ask a developer to seed it").
- **Client self-service activation.** After deployment, the owner's entire path to "live" is: log into `/admin`, complete the setup wizard (Section 7), paste in their WhatsApp/Anthropic/Stripe credentials, add their real vehicles. No code changes, no redeploys, no developer needed for normal operation.
- **Real-time, not batch.** Inbound WhatsApp messages are processed as they arrive via webhook; Stripe payment confirmation is via webhook; there is no polling loop standing in for a webhook anywhere in the shipped product.

### Non-goals (Phase 1)

- No autonomous fine-tuning or self-modifying prompts.
- No fully autonomous refund/exception handling — these always route to the owner.
- No scraping the public website as a pricing source of truth.
- No multi-tenant support in this build (see above).

---

## 2. Tech stack (decisive, opinionated)

This refines the stack away from a split Python-backend / Retool-admin setup toward a **single unified TypeScript application**, because the product requirement ("client just adds API keys and goes live") is best served by one deployable service, one language, and one Cursor-navigable codebase — not two services in two languages that a non-technical owner's hosting has to keep in sync.

| Layer | Choice | Why |
| :---- | :---- | :---- |
| Framework | **Next.js 14+ (App Router), TypeScript** | One codebase serves the admin CMS *and* the webhook/API routes. Cursor reasons about a single project far more reliably than a polyglot split. |
| Database | **PostgreSQL** | Relational integrity for bookings/pricing/escalations; JSONB where flexible (vehicle attributes). |
| ORM | **Prisma** | Schema-as-code, type-safe queries, trivial migrations — ideal for an agent-driven build. |
| Queue / background jobs | **BullMQ on Redis** | Decouples webhook receipt from processing; handles retries, escalation timeout reminders, media re-upload jobs. |
| LLM | **Anthropic Claude (Messages API, tool use)**, `@anthropic-ai/sdk` | Per original direction; strong tool-use reliability for the anti-hallucination architecture in Section 9. |
| Messaging | **Meta WhatsApp Business Cloud API — direct** | No BSP wrapper, no chatbot-builder abstraction, per original direction. |
| Payments | **Stripe Payment Links / Checkout Sessions** | Card data never touches this app's infrastructure — Stripe hosts PCI scope. |
| Object storage | **S3-compatible (Cloudflare R2 or AWS S3)** | Vehicle photo originals; WhatsApp media IDs are cached against vehicle records. |
| Auth (admin) | **Credentials-based session auth** (email + password, Argon2/bcrypt hashing, signed HTTP-only session cookie) | Owner/staff logins only — no customer-facing auth needed. |
| Secrets encryption | **AES-256-GCM, app-level, keyed by `ENCRYPTION_KEY` env var** | Lets integration credentials live safely in Postgres instead of env files (Section 4). |
| Hosting | **Single containerized deploy (Fly.io, Railway, or a VPS via Docker Compose)** running: the Next.js app, a Redis instance, a BullMQ worker process, Postgres (managed or containerized) | One `docker-compose up` / one Fly app should bring the whole platform live. |
| Observability | **Sentry** (errors) + structured JSON logs | Surface pipeline failures before the customer or owner does. |

If the team building this has a strong Python preference, the FastAPI equivalent of every route/worker below is a straightforward port — but build the reference implementation in this stack first; don't split languages mid-build.

---

## 3. Repository structure

```
/app
  /(admin)
    /admin
      /dashboard
      /fleet                 # vehicle CRUD
      /pricing                # pricing rules CRUD
      /policies                # policy text CRUD
      /bookings                # bookings list/detail
      /conversations           # live + historical conversation viewer
      /escalations              # open/resolved escalation queue
      /settings
        /integrations          # <-- the API keys page (Section 6.5)
        /users                 # staff accounts, roles
        /escalation-rules       # editable rule config (Section 11.1)
      /setup                    # first-run onboarding wizard (Section 7)
  /api
    /webhooks
      /whatsapp/route.ts        # GET verify + POST events
      /stripe/route.ts
    /admin
      /vehicles/route.ts
      /pricing-rules/route.ts
      /policies/route.ts
      /bookings/route.ts
      /escalations/route.ts
      /integrations/route.ts    # save/test-connection endpoints
      /auth/[...]/route.ts
/lib
  /db                          # Prisma client singleton
  /integrations
    whatsapp-client.ts          # thin wrapper over Graph API, reads creds from settings service
    claude-client.ts             # Anthropic client, reads key from settings service
    stripe-client.ts             # Stripe client, reads key from settings service
  /settings
    settings-service.ts          # get/set encrypted integration credentials, in-memory TTL cache
    encryption.ts                 # AES-256-GCM helpers
  /agent
    orchestrator.ts               # conversation state machine, calls Claude + tools
    tools/                        # one file per tool in Section 9.3, implements the actual DB/Stripe/WhatsApp logic
    system-prompt.ts              # prompt template + escalation rules injection
    pacing.ts                     # typing delay / send pacing (Section 10)
  /queue
    connection.ts
    jobs/
      process-inbound-message.ts
      escalation-reminder.ts
      media-reupload.ts
    worker.ts                     # BullMQ worker entrypoint (separate process)
/prisma
  schema.prisma
  seed.ts                        # structural seed ONLY (Section 14)
/tests
  unit/
  integration/
  conversation-fixtures/          # red-team / regression conversation scripts (Section 16)
docker-compose.yml
Dockerfile
```

---

## 4. Environment, secrets & configuration model

### 4.1 Bootstrap environment variables (the *only* things that live in `.env` / platform env config)

| Variable | Purpose |
| :---- | :---- |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (queue + cache) |
| `ENCRYPTION_KEY` | 32-byte key used to encrypt/decrypt integration credentials at rest. Generated once at deploy time, never committed, rotatable via a documented re-encryption script. |
| `SESSION_SECRET` | Signs admin session cookies |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Object storage for vehicle photos (infra-level, not a "3rd party the client swaps," so it stays in env) |
| `SENTRY_DSN` | Optional, error tracking |
| `APP_BASE_URL` | Used to build webhook callback URLs shown in the setup wizard |

Everything else — WhatsApp, Anthropic, Stripe — is **not** an env var. It is entered through `/admin/settings/integrations`, encrypted, and stored in the `integration_credentials` table (Section 5). This is what makes "client adds their own API keys and is ready to go" literally true.

### 4.2 Settings service contract

`lib/settings/settings-service.ts` exposes:

```ts
getCredential(provider: "whatsapp" | "anthropic" | "stripe", key: string): Promise<string | null>
setCredential(provider, key, value: string): Promise<void>   // encrypts before writing
testConnection(provider): Promise<{ ok: boolean; detail: string }>
isProviderConfigured(provider): Promise<boolean>
```

Every integration client (`whatsapp-client.ts`, `claude-client.ts`, `stripe-client.ts`) pulls credentials through this service with a short in-memory TTL cache (e.g. 60s) so a key rotation from the admin UI takes effect without a redeploy or restart.

---

## 5. Database schema (Prisma)

```prisma
// prisma/schema.prisma

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         UserRole @default(STAFF)
  createdAt    DateTime @default(now())
}

enum UserRole {
  OWNER
  ADMIN
  STAFF
}

model IntegrationCredential {
  id            String   @id @default(cuid())
  provider      String   // "whatsapp" | "anthropic" | "stripe"
  key           String   // e.g. "access_token", "phone_number_id", "api_key"
  valueEncrypted String
  updatedAt     DateTime @updatedAt

  @@unique([provider, key])
}

model Vehicle {
  id            String   @id @default(cuid())
  make          String
  model         String
  category      String
  year          Int
  dailyRate     Decimal
  weeklyRate    Decimal?
  depositAmount Decimal
  mediaIds      String[] // WhatsApp media IDs, cached
  photoUrls     String[] // S3 originals, source of truth for re-upload
  active        Boolean  @default(true)
  attributes    Json?    // flexible specs (seats, transmission, color, etc.)
  updatedAt     DateTime @updatedAt

  pricingRules       PricingRule[]
  availabilityBlocks AvailabilityBlock[]
  quotes             Quote[]
}

model PricingRule {
  id             String   @id @default(cuid())
  vehicleId      String
  vehicle        Vehicle  @relation(fields: [vehicleId], references: [id])
  ruleType       PricingRuleType
  startDate      DateTime?
  endDate        DateTime?
  adjustmentPct  Decimal?
  adjustmentFlat Decimal?
}

enum PricingRuleType {
  SEASONAL
  DURATION
  WEEKDAY
}

model AvailabilityBlock {
  id        String   @id @default(cuid())
  vehicleId String
  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id])
  startDate DateTime
  endDate   DateTime
  reason    AvailabilityReason
}

enum AvailabilityReason {
  BOOKED
  MAINTENANCE
  HOLD
}

model Policy {
  id            String     @id @default(cuid())
  policyType    PolicyType
  bodyText      String
  effectiveFrom DateTime   @default(now())
}

enum PolicyType {
  DEPOSIT
  DOCUMENTATION
  DELIVERY
  CANCELLATION
}

model Customer {
  id            String   @id @default(cuid())
  whatsappId    String   @unique
  name          String?
  verifiedDocs  Boolean  @default(false)
  createdAt     DateTime @default(now())

  conversations Conversation[]
  bookings      Booking[]
}

model Conversation {
  id            String             @id @default(cuid())
  customerId    String
  customer      Customer           @relation(fields: [customerId], references: [id])
  status        ConversationStatus @default(ACTIVE)
  startedAt     DateTime           @default(now())
  lastMessageAt DateTime           @default(now())
  summary       String?            // rolling summary for context window management

  messages    Message[]
  quotes      Quote[]
  escalations Escalation[]
  outcome     ConversationOutcome?
}

enum ConversationStatus {
  ACTIVE
  ESCALATED
  CLOSED
}

model Message {
  id             String          @id @default(cuid())
  conversationId String
  conversation   Conversation    @relation(fields: [conversationId], references: [id])
  direction      MessageDirection
  type           String          // text | image | reaction | template | interactive
  content        String?
  mediaIds       String[]
  sentAt         DateTime        @default(now())
  metaMessageId  String?         @unique // for idempotency/dedup on webhook retries
}

enum MessageDirection {
  IN
  OUT
}

model Quote {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  vehicleId      String
  vehicle        Vehicle      @relation(fields: [vehicleId], references: [id])
  startDate      DateTime
  endDate        DateTime
  totalPrice     Decimal
  depositDue     Decimal
  status         QuoteStatus  @default(PENDING)
  createdAt      DateTime     @default(now())

  booking Booking?
}

enum QuoteStatus {
  PENDING
  CONFIRMED
  EXPIRED
}

model Booking {
  id               String        @id @default(cuid())
  quoteId          String        @unique
  quote            Quote         @relation(fields: [quoteId], references: [id])
  customerId       String
  customer         Customer      @relation(fields: [customerId], references: [id])
  paymentReference String?
  status           BookingStatus @default(PENDING)
  confirmedAt      DateTime?
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

model Escalation {
  id             String           @id @default(cuid())
  conversationId String
  conversation   Conversation     @relation(fields: [conversationId], references: [id])
  reasonCode     String
  contextSummary String
  status         EscalationStatus @default(OPEN)
  ownerReply     String?
  referenceCode  String           @unique // short code embedded in the owner-facing WhatsApp message, used to match replies
  urgency        String           @default("normal")
  createdAt      DateTime         @default(now())
  resolvedAt     DateTime?
  remindedAt     DateTime?
}

enum EscalationStatus {
  OPEN
  RESOLVED
}

model EscalationRule {
  id           String  @id @default(cuid())
  reasonCode   String  @unique
  label        String
  description  String
  defaultAction String @default("escalate")
  enabled      Boolean @default(true)
}

model ConversationOutcome {
  id             String       @id @default(cuid())
  conversationId String       @unique
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  outcome        OutcomeType
  taggedBy       TaggedBy     @default(SYSTEM)
  taggedAt       DateTime     @default(now())
}

enum OutcomeType {
  BOOKED
  DROPPED
  ESCALATED
}

enum TaggedBy {
  SYSTEM
  HUMAN
}
```

---

## 6. Admin CMS specification

The admin panel is the entire operational surface for the owner. Pages, in build priority order:

### 6.1 Setup wizard (`/admin/setup`) — see Section 7

### 6.2 Dashboard (`/admin/dashboard`)
Snapshot: open escalations count, active conversations, bookings this week, message send success rate, any provider showing as "not connected."

### 6.3 Fleet (`/admin/fleet`)
- Table of vehicles: make, model, category, daily rate, active toggle.
- Create/edit form: all `Vehicle` fields, multi-photo upload (writes to S3, triggers WhatsApp media upload job to populate `mediaIds`).
- Availability calendar per vehicle (reads/writes `AvailabilityBlock`).

### 6.4 Pricing (`/admin/pricing`)
CRUD on `PricingRule`, scoped per vehicle. Simple form: rule type, date range (if seasonal), adjustment as % or flat.

### 6.5 Integrations (`/admin/settings/integrations`) — the page the client actually needs

Three cards, one per provider. Each card has: input fields, a **Save** action (encrypts + upserts into `IntegrationCredential`), a **Test connection** action (calls the provider's cheapest read-only endpoint and reports pass/fail inline), and a live "Connected" / "Not connected" badge driven by `isProviderConfigured()`.

**WhatsApp Business Cloud API**
| Field | Notes |
| :---- | :---- |
| Access token | System-user long-lived token |
| Phone number ID | From Meta Business Manager |
| WhatsApp Business Account ID | Needed for template management |
| App secret | Used to verify webhook signatures |
| Webhook verify token | Owner sets this value here; the setup wizard shows the exact callback URL + this token to paste into Meta's App Dashboard |
| Test connection | Calls `GET /{phone_number_id}` on the Graph API |

**Anthropic (Claude)**
| Field | Notes |
| :---- | :---- |
| API key | |
| Model ID | Dropdown, defaults to the current recommended Claude model; kept editable, not hardcoded, since model names change |
| Test connection | Sends a minimal 1-token Messages API call |

**Stripe**
| Field | Notes |
| :---- | :---- |
| Secret key | |
| Webhook signing secret | For verifying `payment_intent.succeeded` / checkout session events |
| Test connection | Calls `GET /v1/balance` |

### 6.6 Policies (`/admin/policies`)
CRUD on `Policy` rows (deposit, documentation, delivery, cancellation text). This is what `get_policy` reads — plain text the owner controls, no code change needed to update a policy.

### 6.7 Escalation rules (`/admin/settings/escalation-rules`)
Editable list backing `EscalationRule` — toggle rules on/off, edit descriptions. Ships with the defaults in Section 11.1 as structural seed data (not business data).

### 6.8 Conversations (`/admin/conversations`)
Live view of active conversations (message-by-message), searchable history, filter by status/outcome. This is also the Phase 2 substrate (Section 17).

### 6.9 Escalations (`/admin/escalations`)
Open queue with context summary, suggested reply, and a reply box (this can also just be answered directly on WhatsApp per Section 11.2 — the admin view is a convenience, not the only path).

### 6.10 Bookings (`/admin/bookings`)
List/detail of bookings with payment/booking status, linked quote and customer.

### 6.11 Users (`/admin/settings/users`)
Invite staff, assign `OWNER` / `ADMIN` / `STAFF` roles.

---

## 7. First-run setup wizard

On first login (no `IntegrationCredential` rows exist yet), `/admin` redirects to `/admin/setup`, a linear wizard:

1. **Create owner account** (email + password) — only runs if zero `User` rows exist.
2. **Connect WhatsApp** — shows the webhook callback URL (`{APP_BASE_URL}/api/webhooks/whatsapp`) and a generated verify token for the owner to paste into Meta's App Dashboard, then collects the fields in Section 6.5 and runs the test connection.
3. **Connect Claude** — API key + model.
4. **Connect Stripe** — secret key + webhook secret, with the Stripe webhook URL shown (`{APP_BASE_URL}/api/webhooks/stripe`).
5. **Add your first vehicle** — a minimal required step; the platform will not exit the wizard with zero active vehicles, since an agent with an empty catalog can't do its job.
6. **Escalation contact** — confirm the owner's own WhatsApp number (this is where `escalate_to_owner` sends messages).
7. Done → dashboard, with a persistent banner reminding the owner to submit Message Templates (Section 8) to Meta before relying on outside-24h-window messaging.

---

## 8. WhatsApp integration layer (Meta Cloud API — direct)

Built directly on `graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages`.

| Requirement | Implementation |
| :---- | :---- |
| Webhook verification | `GET /api/webhooks/whatsapp` handles Meta's `hub.challenge` handshake against the stored verify token |
| Inbound events | `POST /api/webhooks/whatsapp` validates the `X-Hub-Signature-256` header against the stored app secret, responds `200` immediately, and enqueues a `process-inbound-message` job — all real processing happens off the queue, never inline in the webhook handler |
| Idempotency | Dedup inbound events on `metaMessageId` before enqueueing |
| Typing indicator | Mark inbound message read + send `typing_on` before dispatching a reply; hold duration per Section 10 |
| Reactions | `POST /messages` with `type: reaction` referencing the inbound `message_id` |
| Photos | Upload via `POST /media` once per vehicle (cache the returned `media_id` on `Vehicle.mediaIds`); a `media-reupload` job re-uploads and refreshes the ID if Meta's media expires |
| Payment links | Sent as plain text URL or an interactive CTA-URL message |
| 24-hour session window | Free-form replies only within 24h of the customer's last message; outside that, only approved Message Templates |
| Message templates | Owner must submit templates to Meta (booking confirmation, payment reminder, re-engagement) before these are usable — flagged in the dashboard until confirmed |
| Rate limits/tiering | New WABAs start in a limited messaging tier; surfaced as a dashboard notice, not something the code needs to special-case beyond respecting `429`s with backoff |

---

## 9. Conversational AI layer

### 9.1 Call structure

Every Claude call includes: (1) system prompt — tone/script/hard constraints, itself assembled from the owner's configured escalation rules and policies, not a single static string; (2) the tool definitions below; (3) windowed conversation history plus `Conversation.summary` for anything older; (4) structured customer context (name if known, prior bookings).

### 9.2 Context management

- Rolling window (e.g. last 20 turns) + running summary for older turns.
- Use Anthropic prompt caching (`cache_control` on system prompt + tool definitions) — these are static per conversation and are the largest reusable token block.

### 9.3 Tool definitions (Anthropic tool-use format)

Each tool's implementation lives in `lib/agent/tools/`. **No tool result may be synthesized in code without a real database read (or real Stripe/WhatsApp call) behind it.**

```json
{
  "name": "get_fleet_catalog",
  "description": "List available vehicles matching category/date/budget filters.",
  "input_schema": {
    "type": "object",
    "properties": {
      "start_date": { "type": "string", "format": "date" },
      "end_date": { "type": "string", "format": "date" },
      "category": { "type": "string" },
      "max_daily_budget": { "type": "number" }
    },
    "required": ["start_date", "end_date"]
  }
}
```

```json
{
  "name": "get_vehicle_pricing",
  "description": "Exact price quote for one vehicle over a date range, including applicable pricing rules.",
  "input_schema": {
    "type": "object",
    "properties": {
      "vehicle_id": { "type": "string" },
      "start_date": { "type": "string", "format": "date" },
      "end_date": { "type": "string", "format": "date" }
    },
    "required": ["vehicle_id", "start_date", "end_date"]
  }
}
```

```json
{
  "name": "check_availability",
  "description": "Confirm a vehicle is free for the requested dates; returns the next available window if not.",
  "input_schema": {
    "type": "object",
    "properties": {
      "vehicle_id": { "type": "string" },
      "start_date": { "type": "string", "format": "date" },
      "end_date": { "type": "string", "format": "date" }
    },
    "required": ["vehicle_id", "start_date", "end_date"]
  }
}
```

```json
{
  "name": "get_vehicle_photos",
  "description": "Fetch cached WhatsApp media IDs for a vehicle so they can be sent to the customer.",
  "input_schema": {
    "type": "object",
    "properties": { "vehicle_id": { "type": "string" } },
    "required": ["vehicle_id"]
  }
}
```

```json
{
  "name": "create_quote",
  "description": "Persist a quote against the current conversation.",
  "input_schema": {
    "type": "object",
    "properties": {
      "vehicle_id": { "type": "string" },
      "start_date": { "type": "string", "format": "date" },
      "end_date": { "type": "string", "format": "date" },
      "total_price": { "type": "number" }
    },
    "required": ["vehicle_id", "start_date", "end_date", "total_price"]
  }
}
```

```json
{
  "name": "generate_payment_link",
  "description": "Create a Stripe Payment Link for a confirmed quote.",
  "input_schema": {
    "type": "object",
    "properties": {
      "quote_id": { "type": "string" },
      "amount": { "type": "number" }
    },
    "required": ["quote_id", "amount"]
  }
}
```

```json
{
  "name": "create_booking",
  "description": "Finalize a booking after payment confirmation.",
  "input_schema": {
    "type": "object",
    "properties": {
      "quote_id": { "type": "string" },
      "payment_reference": { "type": "string" }
    },
    "required": ["quote_id", "payment_reference"]
  }
}
```

```json
{
  "name": "get_policy",
  "description": "Retrieve current policy text (deposit, documentation, delivery, or cancellation).",
  "input_schema": {
    "type": "object",
    "properties": {
      "policy_type": { "type": "string", "enum": ["deposit", "documentation", "delivery", "cancellation"] }
    },
    "required": ["policy_type"]
  }
}
```

```json
{
  "name": "escalate_to_owner",
  "description": "Hand off to the human owner with full context. Use whenever a matching escalation rule fires or the agent cannot confidently resolve the customer's request with its available tools.",
  "input_schema": {
    "type": "object",
    "properties": {
      "reason_code": { "type": "string" },
      "conversation_summary": { "type": "string" },
      "urgency": { "type": "string", "enum": ["normal", "high"] }
    },
    "required": ["reason_code", "conversation_summary"]
  }
}
```

### 9.4 Latency budget

| Stage | Budget |
| :---- | :---- |
| Webhook receipt → queued | < 200ms |
| Context assembly (history + KB lookups) | < 500ms |
| Claude response (incl. tool round-trips) | 1.5–3s |
| Message formatting + typing delay + send | 0.5–1.5s |

DB-backed tool calls should be sub-100ms (indexed Postgres queries via Prisma); anything hitting an external API needs caching.

---

## 10. Booking & payment flow

```
Customer → Agent: interested in [vehicle], [dates]
Agent → DB: check_availability + get_vehicle_pricing
Agent → Customer: quote + photos (paced sends)
Customer → Agent: confirms
Agent → DB: create_quote
Agent → Stripe: generate_payment_link(amount)
Agent → Customer: payment link
Customer → Stripe: pays
Stripe → App (webhook): checkout.session.completed / payment_intent.succeeded
App → DB: create_booking
App → Customer: confirmation message
App → Owner: new booking notification (async, informational)
```

**Message pacing** (`lib/agent/pacing.ts`):
- Typing indicator duration: `min(max(text_length * factor_ms, 800), 4000)`.
- 1–2.5s randomized delay between sequential outbound messages.
- Vehicle photos sent as a batch with ~1s gaps; longer pause before the next distinct message.

---

## 11. Escalation & human-in-the-loop

### 11.1 Default escalation rules (structural seed, owner-editable via 6.7)

| reasonCode | Example | Default action |
| :---- | :---- | :---- |
| `refund_request` | "Can I get my deposit back?" | Escalate |
| `eligibility_exception` | Under minimum age, unsupported license country | Escalate |
| `fee_dispute` | "Why was I charged for X?" | Escalate |
| `price_negotiation` | Discount request below policy floor | Escalate |
| `out_of_scope` | No tool/policy can answer confidently | Escalate |
| `repeated_misunderstanding` | Agent fails to resolve intent after N turns | Escalate |
| `explicit_human_request` | "Let me speak to someone" | Escalate immediately |

### 11.2 Flow

```
Customer → Agent: message matching an escalation rule
Agent → App: escalate_to_owner(reason_code, summary, urgency)
App → Owner (WhatsApp): "[REF-XXXX] <customer summary> — <question> — suggested reply: ..."
Agent → Customer: "Let me check on that and get right back to you."
Owner → App: replies (WhatsApp reply-in-thread)
App: matches reply to open Escalation via the REF code embedded in the original message (not free-text parsing)
App → Agent: injects owner's reply into that specific conversation's context
Agent → Customer: resolves using the owner's decision
App: marks escalation resolved, logs resolution
```

- Every owner-facing escalation message embeds a short unique `referenceCode` (e.g. `REF-4821`) — matching is done on that code, never by guessing which conversation a free-text reply belongs to.
- A BullMQ delayed job (`escalation-reminder`) re-pings the owner if an escalation is still `OPEN` after 30 minutes.
- Owner's WhatsApp number is the only number authorized to resolve escalations — verify sender ID on every inbound message to the escalation channel before treating it as a resolution.

---

## 12. Background jobs (BullMQ)

| Job | Trigger | Responsibility |
| :---- | :---- | :---- |
| `process-inbound-message` | Enqueued by the WhatsApp webhook | Loads/creates `Customer` + `Conversation`, runs the orchestrator, sends replies |
| `escalation-reminder` | Delayed 30 min after escalation creation | Re-pings owner if still `OPEN` |
| `media-reupload` | Vehicle photo added, or on `media_id` expiry detected from a failed send | Re-uploads to Meta's media endpoint, updates `Vehicle.mediaIds` |

---

## 13. Security, compliance & data privacy

- **PCI scope**: zero — Stripe-hosted Payment Links/Checkout only.
- **WhatsApp Business Messaging Policy**: opt-in, template approval for outside-24h-window messages, no prohibited content categories.
- **PII**: customer names, phone numbers, and any license/ID documentation are encrypted at rest where stored, access-restricted, retention policy defined; be mindful of UAE PDPL given the business operates in Dubai.
- **Integration credentials**: AES-256-GCM at rest (Section 4), never logged, never returned in full by any API response (mask all but the last 4 characters in the admin UI after save).
- **Admin auth**: hashed passwords (Argon2id or bcrypt with a modern cost factor), HTTP-only signed session cookies, role checks on every admin API route.
- **Escalation channel security**: verify the inbound WhatsApp sender matches the configured owner number before treating a message as an escalation resolution.
- **Webhook signature verification**: both Meta (`X-Hub-Signature-256` against the app secret) and Stripe (signing secret) webhooks must be signature-verified before any processing.

---

## 14. Seed data policy — what IS and ISN'T seeded

`prisma/seed.ts` seeds **only** structural rows the app needs to function on day one:

- `EscalationRule` rows from Section 11.1 (the default rule set — editable, not fake business content).
- `PolicyType` placeholder rows are **not** pre-filled with sample text; create empty `Policy` rows only if the schema needs a row to exist, otherwise leave the table empty and let the admin UI's empty-state prompt the owner to add real policy text.

**Never seeded**: vehicles, customers, conversations, quotes, bookings, escalations, pricing rules. These start at zero rows in every environment, including staging, and are populated only through the admin CMS or real customer/webhook activity. If a demo is needed during development, use a throwaway local `.env` pointed at a scratch database and a Meta test number — never commit fixtures that look like real fleet data.

---

## 15. Build phases — task checklist for the agent

### Phase 0 — Foundation
- [ ] Scaffold Next.js + TypeScript project, Prisma schema from Section 5, initial migration
- [ ] Docker Compose: app, Postgres, Redis
- [ ] Auth: owner account creation, session cookies, role-gated admin routes
- [ ] Settings service + encryption helpers (Section 4.2)
- [ ] Setup wizard skeleton (Section 7), gating `/admin` until complete

### Phase 1 — MVP sales agent
- [ ] Integrations page (Section 6.5) with real test-connection calls for all three providers
- [ ] Fleet, Pricing, Policies, Availability CMS pages (Sections 6.3, 6.4, 6.6)
- [ ] WhatsApp webhook (verify + receive), signature verification, dedup, queue enqueue
- [ ] BullMQ worker process + `process-inbound-message` job
- [ ] Orchestrator + all 9 tools (Section 9.3) wired to real DB/Stripe/WhatsApp calls
- [ ] Message pacing, typing indicator, reactions, paced photo sends (Section 10)
- [ ] Stripe payment link generation + webhook → `create_booking`
- [ ] Escalation flow end-to-end: rule matching, owner notification with REF code, reply matching, re-injection, 30-min reminder job
- [ ] Deploy to a WhatsApp test number; full UAT with the owner using real conversation scenarios end-to-end (real test-mode Stripe, real test WhatsApp number)

### Phase 2 — Logging & improvement loop
- [ ] Conversation log viewer + `ConversationOutcome` tagging (automatic where determinable, manual override in admin)
- [ ] Weekly digest view: escalations, drops, patterns
- [ ] Versioned change log for prompt/policy/escalation-rule edits (who changed what, when — even a simple audit table is enough)
- [ ] Regression test suite: fixed library of conversation scenarios re-run before any prompt/rule change ships (Section 16)
- [ ] (Optional, later) fine-tuning readiness assessment once conversation volume is sufficient — human-curated only, never automatic

---

## 16. Testing & QA plan

- **Unit tests**: every tool function (pricing calc, availability logic, payment link generation) tested independently of the LLM, against a real test database.
- **Integration tests**: against Meta's test WhatsApp number and Stripe test mode — webhook delivery, media upload/send, template messages, payment webhooks.
- **Conversation simulation / red-teaming**: a fixture library (`/tests/conversation-fixtures`) covering ambiguous requests, discount attempts, refund requests, out-of-scope questions — run before every release to confirm correct escalation behavior and zero hallucinated pricing.
- **Load/latency testing**: confirm the 2–5s median holds under realistic concurrent conversation volume.
- **UAT**: owner runs real-world scenarios pre-launch and explicitly signs off on escalation behavior — this is the highest-trust part of the system.

---

## 17. Going live checklist

- [ ] All three Integrations show "Connected" with a passing test-connection result
- [ ] At least one active vehicle with real photos, pricing, and availability
- [ ] All four policy types have real owner-authored text
- [ ] Escalation rules reviewed by the owner (Section 11.1 defaults confirmed or adjusted)
- [ ] Owner's WhatsApp number confirmed as the escalation contact
- [ ] Meta Message Templates submitted and approved (booking confirmation, payment reminder, re-engagement)
- [ ] Stripe account out of test mode (or deliberately kept in test mode for a soft launch — owner's explicit choice, not a default)
- [ ] Sentry/error alerting confirmed working (trigger a deliberate test error)
- [ ] UAT sign-off from the owner on escalation behavior specifically

---

## 18. Appendix — reference links

- Meta WhatsApp Business Cloud API: developers.facebook.com/docs/whatsapp/cloud-api
- Meta Business Messaging Policy: developers.facebook.com/docs/whatsapp/policy
- Stripe Payment Links API: stripe.com/docs/payment-links
- Anthropic Claude Messages API (tool use): docs.claude.com

Verify current API versions, rate-limit tiers, and policy terms directly with Meta/Stripe/Anthropic at build time — these evolve and shouldn't be treated as fixed by this document.
