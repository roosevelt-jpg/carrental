import { describe, expect, it } from "vitest";
import type { MessageTemplate } from "@prisma/client";
import {
  extractTemplateVariables,
  renderContentTemplate,
  toMetaNumberedTemplate,
} from "@/lib/cms/content";
import {
  buildMetaTemplatePayload,
  normalizeMetaTemplateName,
} from "@/lib/integrations/meta-template-publisher";
import { extractWebhookData } from "@/app/api/webhooks/whatsapp/route";

describe("CMS content templates", () => {
  it("extracts named variables once and renders business content", () => {
    const text = "Hello {{business_name}} — booking {{booking_id}} for {{business_name}}.";
    expect(extractTemplateVariables(text)).toEqual(["business_name", "booking_id"]);
    expect(renderContentTemplate(text, { business_name: "Atelier", booking_id: "BK-1" }))
      .toBe("Hello Atelier — booking BK-1 for Atelier.");
    expect(toMetaNumberedTemplate(text, ["business_name", "booking_id"]))
      .toBe("Hello {{1}} — booking {{2}} for {{1}}.");
  });

  it("builds a valid Meta submission payload with review samples", () => {
    const template = {
      id: "template-1",
      name: "Booking Confirmation",
      purpose: "BOOKING_CONFIRMATION",
      language: "en",
      category: "UTILITY",
      status: "DRAFT",
      metaTemplateName: null,
      metaTemplateId: null,
      bodyText: "Booking {{booking_id}} is confirmed for {{vehicle}}.",
      bodyVariables: ["booking_id", "vehicle"],
      sampleValues: ["first real value", "second real value"],
      headerText: "Booking confirmed",
      footerText: "Thank you",
      buttonType: "NONE",
      buttonText: null,
      buttonValue: null,
      rejectionReason: null,
      lastSubmittedAt: null,
      notes: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as MessageTemplate;
    const payload = buildMetaTemplatePayload(template);
    expect(payload.name).toBe("booking_confirmation");
    expect(payload.components).toContainEqual({
      type: "BODY",
      text: "Booking {{1}} is confirmed for {{2}}.",
      example: { body_text: [["first real value", "second real value"]] },
    });
  });

  it("normalizes names and extracts Meta template approval webhooks", () => {
    expect(normalizeMetaTemplateName(" Owner Booking / UAE ")).toBe("owner_booking_uae");
    const result = extractWebhookData({
      entry: [{ changes: [{
        field: "message_template_status_update",
        value: {
          event: "APPROVED",
          message_template_id: "123",
          message_template_name: "owner_booking",
        },
      }] }],
    });
    expect(result.templateUpdates).toEqual([{
      event: "APPROVED",
      message_template_id: "123",
      message_template_name: "owner_booking",
      reason: undefined,
    }]);
  });
});
