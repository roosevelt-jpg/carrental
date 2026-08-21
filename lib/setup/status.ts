import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
import { getCredential, isProviderConfigured } from "@/lib/settings/settings-service";

export type SetupStatus = {
  hasUsers: boolean;
  whatsapp: boolean;
  anthropic: boolean;
  stripe: boolean;
  hasVehicle: boolean;
  hasEscalationContact: boolean;
  complete: boolean;
  currentStep: number;
  whatsappWebhookUrl: string;
  stripeWebhookUrl: string;
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

  const baseUrl = getAppBaseUrl();

  return {
    hasUsers,
    whatsapp,
    anthropic,
    stripe,
    hasVehicle,
    hasEscalationContact,
    complete: flags.every(Boolean),
    currentStep,
    whatsappWebhookUrl: `${baseUrl}/api/webhooks/whatsapp`,
    stripeWebhookUrl: `${baseUrl}/api/webhooks/stripe`,
  };
}
