import type { MessageTemplatePurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getCmsSettings() {
  return prisma.cmsSettings.upsert({
    where: { id: "primary" },
    create: { id: "primary" },
    update: {},
  });
}

export async function getPublicCmsContent(options: { draft?: boolean } = {}) {
  const [draftSettings, faqs, vehicles] = await Promise.all([
    getCmsSettings(),
    prisma.faqEntry.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.vehicle.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { make: "asc" }, { model: "asc" }],
    }),
  ]);
  const published = draftSettings.publishedSnapshot as Record<string, unknown> | null;
  const settings = !options.draft && draftSettings.sitePublished && published
    ? { ...draftSettings, ...published }
    : draftSettings;
  return { settings, faqs, vehicles };
}

export function snapshotForJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const variablePattern = /{{\s*([a-z][a-z0-9_]*)\s*}}/gi;

export function extractTemplateVariables(text: string) {
  const variables: string[] = [];
  for (const match of text.matchAll(variablePattern)) {
    const name = match[1].toLowerCase();
    if (!variables.includes(name)) variables.push(name);
  }
  return variables;
}

export function renderContentTemplate(
  text: string,
  values: Record<string, string | number | null | undefined>,
) {
  return text.replace(variablePattern, (token, rawName: string) => {
    const value = values[rawName.toLowerCase()];
    return value === null || value === undefined ? token : String(value);
  });
}

export function toMetaNumberedTemplate(text: string, variables: string[]) {
  return text.replace(variablePattern, (token, rawName: string) => {
    const index = variables.indexOf(rawName.toLowerCase());
    return index === -1 ? token : `{{${index + 1}}}`;
  });
}

export async function prepareNotification(params: {
  purpose: MessageTemplatePurpose;
  values: Record<string, string | number | null | undefined>;
  fallback: string;
}) {
  const template = await prisma.messageTemplate.findFirst({
    where: { purpose: params.purpose },
    orderBy: { updatedAt: "desc" },
  });
  if (!template?.bodyText.trim()) {
    return { text: params.fallback, parameters: [params.fallback] };
  }
  const unresolved = template.bodyVariables.filter(
    (name) => params.values[name] === undefined || params.values[name] === null,
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Missing ${params.purpose} notification values: ${unresolved.join(", ")}`,
    );
  }
  return {
    text: renderContentTemplate(template.bodyText, params.values),
    parameters: template.bodyVariables.map((name) => String(params.values[name] ?? "")),
  };
}
