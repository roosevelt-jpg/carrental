import { prisma } from "@/lib/db";
import {
  getAppBaseUrl,
  getStripeWebhookUrl,
  getWhatsAppWebhookUrl,
} from "@/lib/env";
import {
  getCredential,
  isProviderConfigured,
} from "@/lib/settings/settings-service";
import { getGoLiveChecklist, isGoLiveReady } from "@/lib/setup/go-live-checklist";

export type SetupStatus = {
  hasUsers: boolean;
  whatsapp: boolean;
  anthropic: boolean;
  stripe: boolean;
  hasVehicle: boolean;
  hasEscalationContact: boolean;
  coreComplete: boolean;
  activationReady: boolean;
  readinessDone: number;
  readinessTotal: number;
  complete: boolean;
  currentStep: number;
  whatsappWebhookUrl: string;
  stripeWebhookUrl: string;
  baseUrl: string;
};

export async function getSetupStatus(): Promise<SetupStatus> {
  const [userCount, vehicleCount, whatsapp, anthropic, stripe, ownerPhone] =
    await Promise.all([
      prisma.user.count(),
      prisma.vehicle.count({ where: { active: true } }),
      isProviderConfigured("whatsapp"),
      isProviderConfigured("anthropic"),
      isProviderConfigured("stripe"),
      getCredential("whatsapp", "owner_phone_number"),
    ]);

  const hasUsers = userCount > 0;
  const hasVehicle = vehicleCount > 0;
  const hasEscalationContact = Boolean(ownerPhone);

  const flags = [
    hasUsers,
    whatsapp,
    anthropic,
    stripe,
    hasVehicle,
    hasEscalationContact,
  ];
  const firstIncomplete = flags.findIndex((flag) => !flag);
  const currentStep = firstIncomplete === -1 ? 6 : firstIncomplete;
  const coreComplete = flags.every(Boolean);
  const readiness = coreComplete ? await getGoLiveChecklist() : [];
  const requiredReadiness = readiness.filter((item) => item.required !== false);
  const activationReady = coreComplete && isGoLiveReady(readiness);

  return {
    hasUsers,
    whatsapp,
    anthropic,
    stripe,
    hasVehicle,
    hasEscalationContact,
    coreComplete,
    activationReady,
    readinessDone: requiredReadiness.filter((item) => item.done).length,
    readinessTotal: requiredReadiness.length,
    complete: activationReady,
    currentStep,
    whatsappWebhookUrl: getWhatsAppWebhookUrl(),
    stripeWebhookUrl: getStripeWebhookUrl(),
    baseUrl: getAppBaseUrl(),
  };
}
