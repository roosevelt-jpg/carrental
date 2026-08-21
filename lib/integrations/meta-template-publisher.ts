import type { MessageTemplate } from "@prisma/client";
import { extractTemplateVariables, toMetaNumberedTemplate } from "@/lib/cms/content";

export function normalizeMetaTemplateName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

export function validateTemplateForPublishing(template: MessageTemplate) {
  const variables = extractTemplateVariables(template.bodyText);
  if (!template.bodyText.trim()) throw new Error("Template body is required");
  if (template.bodyText.length > 1024) throw new Error("Meta template body must be 1,024 characters or fewer");
  if (variables.join("|") !== template.bodyVariables.join("|")) {
    throw new Error("Template variables are out of sync. Save the template before publishing.");
  }
  if (template.sampleValues.length !== variables.length) {
    throw new Error("Every template variable needs a sample value for Meta review");
  }
  if (template.sampleValues.some((value) => !value.trim())) {
    throw new Error("Template sample values cannot be empty");
  }
  if (template.buttonType !== "NONE" && !template.buttonText?.trim()) {
    throw new Error("Button text is required");
  }
  if (
    (template.buttonType === "URL" || template.buttonType === "PHONE_NUMBER") &&
    !template.buttonValue?.trim()
  ) {
    throw new Error("Button destination is required");
  }
}

export function buildMetaTemplatePayload(template: MessageTemplate) {
  validateTemplateForPublishing(template);
  const components: Array<Record<string, unknown>> = [];
  if (template.headerText?.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: template.headerText.trim() });
  }
  const body: Record<string, unknown> = {
    type: "BODY",
    text: toMetaNumberedTemplate(template.bodyText.trim(), template.bodyVariables),
  };
  if (template.sampleValues.length > 0) {
    body.example = { body_text: [template.sampleValues] };
  }
  components.push(body);
  if (template.footerText?.trim()) {
    components.push({ type: "FOOTER", text: template.footerText.trim() });
  }
  if (template.buttonType !== "NONE") {
    const button =
      template.buttonType === "QUICK_REPLY"
        ? { type: "QUICK_REPLY", text: template.buttonText }
        : template.buttonType === "URL"
          ? { type: "URL", text: template.buttonText, url: template.buttonValue }
          : { type: "PHONE_NUMBER", text: template.buttonText, phone_number: template.buttonValue };
    components.push({ type: "BUTTONS", buttons: [button] });
  }
  return {
    name: normalizeMetaTemplateName(template.metaTemplateName || template.name),
    language: template.language,
    category: template.category,
    allow_category_change: true,
    components,
  };
}
