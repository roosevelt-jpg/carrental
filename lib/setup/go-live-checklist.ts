import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
import { getDataRetentionDays } from "@/lib/settings/business-controls";
import {
  getCredential,
  isProviderConfigured,
} from "@/lib/settings/settings-service";
import { getStorageBackend } from "@/lib/storage/object-storage";
import { percentile } from "@/lib/analytics/latency";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
  required?: boolean;
};

export function isGoLiveReady(items: ChecklistItem[]) {
  return items.filter((item) => item.required !== false).every((item) => item.done);
}

export async function getGoLiveChecklist(): Promise<ChecklistItem[]> {
  const [
    whatsapp,
    anthropic,
    stripe,
    vehicleCount,
    policyTypes,
    ownerPhone,
    templates,
    openEscalations,
    vehiclesWithPhotos,
    workerHeartbeat,
    cms,
    faqCount,
    knowledgeCount,
    knowledgeDocumentCount,
    activationReview,
    latencyMetrics,
    processingLatency,
    integrationTests,
    webhookEvidence,
    stripeWebhookEvidence,
    unencryptedPii,
  ] = await Promise.all([
    isProviderConfigured("whatsapp"),
    isProviderConfigured("anthropic"),
    isProviderConfigured("stripe"),
    prisma.vehicle.count({ where: { active: true } }),
    prisma.policy.findMany({ select: { policyType: true } }),
    getCredential("whatsapp", "owner_phone_number"),
    prisma.messageTemplate.findMany(),
    prisma.escalation.count({ where: { status: "OPEN" } }),
    prisma.vehicle.count({
      where: { active: true, photoUrls: { isEmpty: false } },
    }),
    prisma.workerHeartbeat.findUnique({ where: { id: "primary" } }),
    prisma.cmsSettings.upsert({ where: { id: "primary" }, create: { id: "primary" }, update: {} }),
    prisma.faqEntry.count({ where: { active: true } }),
    prisma.knowledgeEntry.count({ where: { active: true } }),
    prisma.knowledgeDocument.count({ where: { status: "VERIFIED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.activationReview.upsert({ where: { id: "primary" }, create: { id: "primary" }, update: {} }),
    prisma.pipelineLatencyMetric.findMany({ orderBy: { createdAt: "desc" }, take: 5000, select: { stage: true, latencyMs: true } }),
    prisma.processingMetric.findMany({ orderBy: { createdAt: "desc" }, take: 2000, select: { latencyMs: true } }),
    prisma.integrationTestResult.findMany(),
    prisma.whatsAppWebhookEvent.groupBy({ by: ["kind"], where: { status: "COMPLETE" }, _count: true }),
    prisma.processedWebhookEvent.count({ where: { provider: "stripe", status: "COMPLETE" } }),
    Promise.all([
      prisma.customer.count({ where: { OR: [{ whatsappId: { not: { startsWith: "enc:v1:" } } }, { whatsappIdHash: null }, { AND: [{ name: { not: null } }, { name: { not: { startsWith: "enc:v1:" } } }] }] } }),
      prisma.message.count({ where: { AND: [{ content: { not: null } }, { content: { not: { startsWith: "enc:v1:" } } }] } }),
      prisma.conversation.count({ where: { AND: [{ summary: { not: null } }, { summary: { not: { startsWith: "enc:v1:" } } }] } }),
      prisma.escalation.count({ where: { OR: [{ contextSummary: { not: { startsWith: "enc:v1:" } } }, { AND: [{ suggestedReply: { not: null } }, { suggestedReply: { not: { startsWith: "enc:v1:" } } }] }, { AND: [{ ownerReply: { not: null } }, { ownerReply: { not: { startsWith: "enc:v1:" } } }] }] } }),
    ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
  ]);

  const presentTypes = new Set(policyTypes.map((p) => p.policyType));
  const requiredPolicies = [
    "DEPOSIT",
    "DOCUMENTATION",
    "DELIVERY",
    "CANCELLATION",
  ] as const;
  const policiesComplete = requiredPolicies.every((t) => presentTypes.has(t));
  const templatesApproved = templates.filter((t) => t.status === "APPROVED")
    .length;
  const stripeKey = await getCredential("stripe", "secret_key");
  const stripeLive = Boolean(stripeKey?.startsWith("sk_live_"));
  const storage = getStorageBackend();
  const baseUrl = getAppBaseUrl();
  const baseLooksProduction =
    baseUrl.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(baseUrl);
  const workerHealthy = Boolean(
    workerHeartbeat && Date.now() - workerHeartbeat.updatedAt.getTime() < 90_000,
  );
  const retentionDays = await getDataRetentionDays();
  const databaseTls =
    !baseLooksProduction || /sslmode=(require|verify-ca|verify-full)/i.test(process.env.DATABASE_URL ?? "");
  const latencyBudgets = [
    { stage: "webhook_to_queue", target: 200, values: latencyMetrics.filter((row) => row.stage === "webhook_to_queue").map((row) => row.latencyMs) },
    { stage: "context_assembly", target: 500, values: latencyMetrics.filter((row) => row.stage === "context_assembly").map((row) => row.latencyMs) },
    { stage: "db_tool", target: 100, values: latencyMetrics.filter((row) => row.stage === "db_tool").map((row) => row.latencyMs) },
    { stage: "end_to_end", target: 5000, values: processingLatency.map((row) => row.latencyMs) },
  ];
  const latencyPassing = latencyBudgets.every((item) => item.values.length >= 20 && (percentile(item.values, .95) ?? Infinity) <= item.target);
  const freshTestCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const testedProviders = new Set(integrationTests.filter((test) => test.ok && test.testedAt.getTime() >= freshTestCutoff).map((test) => test.provider));
  const webhookKinds = new Set(webhookEvidence.filter((row) => row._count > 0).map((row) => row.kind));

  return [
    {
      id: "base-url",
      label: "Public production domain configured",
      done: baseLooksProduction,
      detail: baseUrl,
    },
    {
      id: "https",
      label: "Public origin uses HTTPS",
      done: baseUrl.startsWith("https://"),
      detail: baseUrl,
    },
    {
      id: "database-tls",
      label: "Production database connection requires TLS",
      done: databaseTls,
      detail: databaseTls ? "TLS requirement detected" : "Add sslmode=require (or stronger)",
    },
    {
      id: "storage",
      label: "Durable object storage ready",
      done: storage !== "local",
      detail:
        storage === "vercel-blob"
          ? "Vercel Blob"
          : storage === "s3"
            ? "S3-compatible"
            : "Local disk only — connect Vercel Blob or configure S3",
    },
    {
      id: "integrations",
      label: "WhatsApp, Claude, and Stripe all connected",
      done: whatsapp && anthropic && stripe && ["whatsapp", "anthropic", "stripe"].every((provider) => testedProviders.has(provider)),
      detail: `Requires configured credentials and a passing real connection test within the last 24 hours`,
    },
    {
      id: "meta-webhook-confirmed",
      label: "Meta webhook registered and verified",
      done: whatsapp && activationReview.metaWebhookConfirmed && webhookKinds.has("INBOUND_MESSAGE"),
      detail: activationReview.metaWebhookConfirmed
        ? `Confirmed by ${activationReview.confirmedByEmail ?? "an administrator"}`
        : "Register and confirm the callback; at least one signed inbound webhook must also be processed",
    },
    {
      id: "stripe-webhook-confirmed",
      label: "Stripe webhook registered and signing secret verified",
      done: stripe && activationReview.stripeWebhookConfirmed && stripeWebhookEvidence > 0,
      detail: activationReview.stripeWebhookConfirmed
        ? `Confirmed by ${activationReview.confirmedByEmail ?? "an administrator"}`
        : "Register and confirm the endpoint; at least one signed Stripe test webhook must also complete",
    },
    {
      id: "cms-business",
      label: "Business profile and contact details completed",
      done: Boolean(cms.businessName && cms.businessDescription && (cms.phone || cms.whatsappDisplay) && cms.email),
      detail: `${cms.businessName} · ${cms.city}`,
    },
    {
      id: "cms-agent",
      label: "AI tone, sales playbook, and handoff wording authored",
      done: Boolean(cms.agentTone && cms.salesScript && cms.agentHandoffMessage && cms.prohibitedClaims),
      detail: `${faqCount} FAQs · ${knowledgeCount} verified answers · ${knowledgeDocumentCount} verified documents`,
    },
    {
      id: "cms-published",
      label: "Public website content published",
      done: cms.sitePublished,
      detail: `CMS revision ${cms.revision}`,
    },
    {
      id: "vehicle",
      label: "At least one active vehicle",
      done: vehicleCount > 0,
      detail: `${vehicleCount} active`,
    },
    {
      id: "photos",
      label: "At least one vehicle has photos (Blob → WhatsApp media)",
      done: vehiclesWithPhotos > 0,
      detail: `${vehiclesWithPhotos} with photos`,
    },
    {
      id: "policies",
      label: "All four policy types authored",
      done: policiesComplete,
      detail: `${presentTypes.size}/4 types present`,
    },
    {
      id: "escalation-contact",
      label: "Owner WhatsApp escalation number set",
      done: Boolean(ownerPhone),
    },
    {
      id: "escalation-rules-reviewed",
      label: "Escalation rules reviewed by the owner",
      done: activationReview.escalationRulesReviewed,
    },
    {
      id: "templates",
      label: "Meta message templates approved",
      done: templates.length > 0 && templatesApproved === templates.length,
      detail: `${templatesApproved}/${templates.length || 3} approved`,
    },
    {
      id: "stripe-mode",
      label: "Stripe mode reviewed (test vs live)",
      done: Boolean(stripeKey) && activationReview.stripeModeReviewed,
      detail: stripeKey
        ? stripeLive
          ? "Live key detected"
          : "Test key detected — OK for soft launch"
        : "No Stripe key yet",
    },
    {
      id: "worker",
      label: "Background worker is online",
      done: workerHealthy,
      detail: workerHeartbeat
        ? `Last heartbeat ${workerHeartbeat.updatedAt.toISOString()}`
        : "No worker heartbeat recorded",
    },
    {
      id: "pii-encryption",
      label: "Stored customer and conversation PII is encrypted",
      done: unencryptedPii === 0,
      detail: unencryptedPii === 0 ? "All inspected sensitive rows use AES-256-GCM envelopes and hashed phone lookup keys" : `${unencryptedPii} legacy rows still require npm run encrypt-existing-pii`,
    },
    {
      id: "retention",
      label: "Customer-data retention policy configured",
      done: retentionDays >= 30,
      detail: `${retentionDays} days; closed conversations are anonymized automatically`,
    },
    {
      id: "sentry",
      label: "Sentry error monitoring tested end to end",
      done: Boolean(process.env.SENTRY_DSN) && activationReview.sentryTestConfirmed,
      detail: process.env.SENTRY_DSN ? "DSN configured; owner must verify the deliberate test event was received" : "SENTRY_DSN not set",
    },
    {
      id: "open-escalations",
      label: "No unexpected open escalations before launch",
      done: openEscalations === 0,
      detail: `${openEscalations} open`,
    },
    {
      id: "latency-evidence",
      label: "Production latency budgets measured",
      done: latencyPassing,
      detail: "At least 20 real samples per stage and p95 within every target; review exact evidence in Analytics",
    },
    {
      id: "owner-uat",
      label: "Owner completed end-to-end WhatsApp and Stripe UAT",
      done: activationReview.ownerUatSignedOff,
      detail: activationReview.ownerUatSignedOff
        ? `Signed off by ${activationReview.confirmedByEmail ?? "an administrator"}`
        : "Complete a real test conversation, escalation, quote, payment, and booking before confirming",
    },
  ];
}
