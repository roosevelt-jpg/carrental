import { getCmsSettings } from "@/lib/cms/content";

export async function getQuoteHoldMinutes() {
  const { quoteHoldMinutes } = await getCmsSettings();
  if (!Number.isInteger(quoteHoldMinutes) || quoteHoldMinutes < 30 || quoteHoldMinutes > 1440) {
    throw new Error("Quote hold must be between 30 and 1,440 minutes");
  }
  return quoteHoldMinutes;
}

export async function getDataRetentionDays() {
  const { dataRetentionDays } = await getCmsSettings();
  if (!Number.isInteger(dataRetentionDays) || dataRetentionDays < 30) {
    throw new Error("Data retention must be at least 30 days");
  }
  return dataRetentionDays;
}
