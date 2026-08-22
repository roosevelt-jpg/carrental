import { getCmsSettings } from "@/lib/cms/content";

export async function getBusinessProfile() {
  const cms = await getCmsSettings();
  const profile = {
    business_name: cms.businessName,
    legal_name: cms.legalName,
    description: cms.businessDescription,
    phone: cms.phone,
    email: cms.email,
    whatsapp: cms.whatsappDisplay,
    address: cms.address,
    city: cms.city,
    country: cms.country,
    timezone: cms.timezone,
    currency: cms.currency,
  };
  const required = [
    ["business_name", profile.business_name],
    ["city", profile.city],
    ["country", profile.country],
    ["timezone", profile.timezone],
    ["currency", profile.currency],
  ] as const;
  const missing: string[] = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
  if (!profile.phone?.trim() && !profile.whatsapp?.trim()) missing.push("phone_or_whatsapp");
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Business profile is incomplete (${missing.join(", ")}). Escalate rather than infer missing details.`,
    };
  }
  return {
    ok: true,
    profile,
    instruction: "Only non-empty returned fields are authoritative. Escalate if the requested detail is blank.",
  };
}
