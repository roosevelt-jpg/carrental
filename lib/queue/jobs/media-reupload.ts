import { prisma } from "@/lib/db";
import { isProviderConfigured } from "@/lib/settings/settings-service";
import { uploadMediaFromUrl } from "@/lib/integrations/whatsapp-client";

export type MediaReuploadJob = {
  vehicleId: string;
};

export async function processMediaReupload(data: MediaReuploadJob) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: data.vehicleId },
  });
  if (!vehicle) {
    return { skipped: true, reason: "missing_vehicle" };
  }
  if (vehicle.photoUrls.length === 0) {
    return { skipped: true, reason: "no_photo_urls" };
  }

  const whatsappReady = await isProviderConfigured("whatsapp");
  if (!whatsappReady) {
    return {
      skipped: true,
      reason: "whatsapp_not_configured",
      note: "Photos stay in storage until WhatsApp credentials are added, then re-run media upload.",
    };
  }

  const mediaIds: string[] = [];
  for (const url of vehicle.photoUrls) {
    const mime = mimeFromUrl(url);
    const id = await uploadMediaFromUrl(url, mime);
    mediaIds.push(id);
  }

  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { mediaIds },
  });
  return { mediaIds };
}

function mimeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
  } catch {
    const lower = url.toLowerCase();
    if (lower.includes(".png")) return "image/png";
    if (lower.includes(".webp")) return "image/webp";
  }
  return "image/jpeg";
}
