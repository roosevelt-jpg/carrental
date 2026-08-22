import { getCmsSettings } from "@/lib/cms/content";

export async function getBusinessTime() {
  const cms = await getCmsSettings();
  const now = new Date();
  let timezone = cms.timezone || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now); } catch { timezone = "UTC"; }
  return {
    timezone,
    iso_utc: now.toISOString(),
    local_date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    local_time: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now),
    local_display: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(now),
  };
}
