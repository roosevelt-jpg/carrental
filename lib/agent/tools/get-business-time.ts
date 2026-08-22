import { getCmsSettings } from "@/lib/cms/content";

export async function getBusinessTime() {
  const cms = await getCmsSettings();
  const now = new Date();
  const timezone = cms.timezone.trim();
  if (!timezone) {
    return { ok: false, error: "Business timezone is not configured. Escalate rather than assume one." };
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now);
  } catch {
    return { ok: false, error: "Configured business timezone is invalid. Escalate rather than assume one." };
  }
  return {
    ok: true,
    timezone,
    iso_utc: now.toISOString(),
    local_date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    local_time: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now),
    local_display: new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(now),
  };
}
