import { prisma } from "@/lib/db";
import { getAppBaseUrl, getDataRetentionDays } from "@/lib/env";
import {
  getCredential,
  isProviderConfigured,
} from "@/lib/settings/settings-service";
import { getStorageBackend } from "@/lib/storage/object-storage";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
};

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
  const productionHost = "carrental.myflynai.com";
  const baseLooksProduction =
    baseUrl.includes(productionHost) || Boolean(process.env.VERCEL);
  const workerHealthy = Boolean(
    workerHeartbeat && Date.now() - workerHeartbeat.updatedAt.getTime() < 90_000,
  );
  const retentionDays = getDataRetentionDays();
  const databaseTls =
    !baseLooksProduction || /sslmode=(require|verify-ca|verify-full)/i.test(process.env.DATABASE_URL ?? "");

  return [
    {
      id: "base-url",
      label: `Public domain set (${productionHost})`,
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
      label: "Object storage ready (Vercel Blob or S3)",
      done: storage !== "local",
      detail:
        storage === "vercel-blob"
          ? "Vercel Blob"
          : storage === "s3"
            ? "S3-compatible"
            : "Local disk only — set BLOB_READ_WRITE_TOKEN on Vercel",
    },
    {
      id: "integrations",
      label: "WhatsApp, Claude, and Stripe all connected",
      done: whatsapp && anthropic && stripe,
      detail: `WA ${whatsapp ? "ok" : "missing"} · Claude ${anthropic ? "ok" : "missing"} · Stripe ${stripe ? "ok" : "missing"}`,
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
      detail: `${faqCount} FAQs · ${knowledgeCount} knowledge entries`,
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
      id: "templates",
      label: "Meta message templates approved",
      done: templates.length > 0 && templatesApproved === templates.length,
      detail: `${templatesApproved}/${templates.length || 3} approved`,
    },
    {
      id: "stripe-mode",
      label: "Stripe mode reviewed (test vs live)",
      done: Boolean(stripeKey),
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
      id: "retention",
      label: "Customer-data retention policy configured",
      done: retentionDays >= 30,
      detail: `${retentionDays} days; closed conversations are anonymized automatically`,
    },
    {
      id: "sentry",
      label: "Sentry error monitoring configured",
      done: Boolean(process.env.SENTRY_DSN),
      detail: process.env.SENTRY_DSN ? "SENTRY_DSN set" : "Not set",
    },
    {
      id: "open-escalations",
      label: "No unexpected open escalations before launch",
      done: openEscalations === 0,
      detail: `${openEscalations} open`,
    },
  ];
}
