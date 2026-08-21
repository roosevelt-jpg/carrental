import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
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

  return [
    {
      id: "base-url",
      label: `Public domain set (${productionHost})`,
      done: baseLooksProduction,
      detail: baseUrl,
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
      id: "sentry",
      label: "Sentry DSN configured (optional but recommended)",
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
