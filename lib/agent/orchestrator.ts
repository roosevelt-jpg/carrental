import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getClaudeClient, getClaudeModelId } from "@/lib/integrations/claude-client";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { AGENT_TOOLS } from "@/lib/agent/tool-definitions";
import { executeTool } from "@/lib/agent/tools";
import { escalateToOwner } from "@/lib/agent/tools/escalate-to-owner";
import { matchEscalationHint } from "@/lib/agent/escalation-hint";
import { recordLatency } from "@/lib/analytics/latency";
import { decryptPii, encryptPii } from "@/lib/privacy/pii";
import { readStoredObject } from "@/lib/storage/object-storage";

const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 8;
const MISUNDERSTANDING_TURN_THRESHOLD = 3;
const HARD_ESCALATION_REASONS = new Set([
  "refund_request",
  "eligibility_exception",
  "fee_dispute",
  "repeated_misunderstanding",
  "explicit_human_request",
]);
const AUTHORITATIVE_TOOLS = new Set(["get_business_profile", "get_fleet_catalog", "get_vehicle_pricing", "check_availability", "get_policy", "search_knowledge", "get_business_time"]);
const FACT_SENSITIVE_REQUEST = /\b(price|pricing|cost|rate|quote|available|availability|today|tomorrow|date|time|open|close|hour|address|location|where|phone|email|contact|business|company|deposit|delivery|cancel|refund|insurance|licen[cs]e|age|document|policy|seat|door|transmission|engine|fuel|mileage|kilomet|color|colour|year|make|model|feature|spec|luggage|brand)\b/i;

export function requiresAuthoritativeTool(text: string) {
  return FACT_SENSITIVE_REQUEST.test(text);
}

export function requiredAuthoritativeTools(text: string): Set<string> {
  const groups: Array<[RegExp, string[]]> = [
    [/\b(price|pricing|cost|rate|quote|deposit)\b/i, ["get_vehicle_pricing", "get_fleet_catalog"]],
    [/\b(available|availability)\b/i, ["check_availability", "get_fleet_catalog"]],
    [/\b(today|tomorrow|date|time|open|close|hour)\b/i, ["get_business_time"]],
    [/\b(address|location|where|phone|email|contact|business|company|currency)\b/i, ["get_business_profile"]],
    [/\b(cancel|refund|insurance|licen[cs]e|age|document|policy|delivery)\b/i, ["get_policy", "search_knowledge"]],
    [/\b(seat|door|transmission|engine|fuel|mileage|kilomet|color|colour|year|make|model|feature|spec|luggage|brand)\b/i, ["get_fleet_catalog", "get_vehicle_pricing"]],
  ];
  const required = new Set<string>();
  for (const [pattern, tools] of groups) {
    if (pattern.test(text)) tools.forEach((tool) => required.add(tool));
  }
  return required;
}

export type AgentReply = {
  texts: string[];
  mediaIds: string[];
  escalated: boolean;
  paymentLinks: Array<{ url: string; amount: number; currency: string }>;
  toolRounds: number;
};

export async function runOrchestrator(conversationId: string): Promise<AgentReply> {
  const contextStartedAt = Date.now();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: "desc" }, take: HISTORY_LIMIT, include: { attachments: true } },
      quotes: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const system = await buildSystemPrompt();
  const history = [...conversation.messages].reverse();
  const claudeMessages: Anthropic.MessageParam[] = [];

  const conversationSummary = decryptPii(conversation.summary);
  if (conversationSummary) {
    claudeMessages.push({
      role: "user",
      content: `Earlier conversation summary: ${conversationSummary}`,
    });
    claudeMessages.push({
      role: "assistant",
      content: "Understood. I will use tools for any factual claim.",
    });
  }

  for (const message of history) {
    if (!message.content && message.mediaIds.length === 0 && message.attachments.length === 0) continue;
    const text =
      decryptPii(message.content) ??
      (message.mediaIds.length || message.attachments.length ? "[media message]" : "");
    if (message.direction === "IN") {
      claudeMessages.push({ role: "user", content: await inboundMessageContent(message, text) });
    } else {
      claudeMessages.push({ role: "assistant", content: text });
    }
  }

  const latestInbound = [...history].reverse().find((m) => m.direction === "IN");
  const latestInboundText = decryptPii(latestInbound?.content) ?? (latestInbound?.attachments.length ? `[Customer sent ${latestInbound.attachments.map((item) => item.mediaType).join(", ")}]` : null);
  const unreadableAttachment = latestInbound?.attachments.find((item) => item.status !== "READY");
  const hint = conversation.misunderstandingCount >= MISUNDERSTANDING_TURN_THRESHOLD - 1 ? "repeated_misunderstanding" : latestInboundText ? matchEscalationHint(latestInboundText) : null;
  if (hint) {
    claudeMessages.push({
      role: "user",
      content: `System hint: the latest customer message strongly matches escalation reason_code "${hint}". If still applicable, call escalate_to_owner with that reason_code. Do not invent facts.`,
    });
    claudeMessages.push({
      role: "assistant",
      content: "Understood. I will escalate with the matching reason_code if the request still requires an owner decision.",
    });
  }

  const hintedRule = hint
    ? await prisma.escalationRule.findUnique({ where: { reasonCode: hint }, select: { enabled: true } })
    : null;
  await recordLatency("context_assembly", contextStartedAt, conversationId);
  if (unreadableAttachment) {
    const escalation = await escalateToOwner(conversationId, {
      reason_code: "out_of_scope",
      conversation_summary: `Customer attachment could not be interpreted safely (${unreadableAttachment.mediaType}, status ${unreadableAttachment.status}). Review it in the conversation dashboard.`,
      urgency: "normal",
    });
    return {
      texts: [escalation.customer_message ?? "I’ve shared that attachment with the team for review."],
      mediaIds: [],
      escalated: true,
      paymentLinks: [],
      toolRounds: 0,
    };
  }
  if (hint && hintedRule?.enabled && HARD_ESCALATION_REASONS.has(hint)) {
    const escalation = await escalateToOwner(conversationId, {
      reason_code: hint,
      conversation_summary: latestInboundText ?? `Customer request matched ${hint}`,
      urgency: hint === "explicit_human_request" ? "high" : "normal",
    });
    return {
      texts: [escalation.customer_message ?? "Let me check on that and get right back to you."],
      mediaIds: [],
      escalated: true,
      paymentLinks: [],
      toolRounds: 0,
    };
  }

  const client = await getClaudeClient();
  const model = await getClaudeModelId();
  const mediaIds: string[] = [];
  const paymentLinks: AgentReply["paymentLinks"] = [];
  let escalated = false;
  let toolRounds = 0;
  const usedTools = new Set<string>();

  let response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: AGENT_TOOLS.map((tool, index) =>
      index === 0
        ? { ...tool, cache_control: { type: "ephemeral" as const } }
        : tool,
    ),
    messages: claudeMessages,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (response.stop_reason !== "tool_use") {
      break;
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    toolRounds += 1;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      usedTools.add(toolUse.name);
      const toolStartedAt = Date.now();
      const result = await executeTool(toolUse.name, toolUse.input, {
        conversationId,
      });
      const toolStage = toolUse.name === "generate_payment_link" || toolUse.name === "escalate_to_owner" ? "external_tool" : "db_tool";
      await recordLatency(toolStage, toolStartedAt, `${conversationId}:${toolUse.name}`);

      const resultRecord = result as { ok?: boolean; error?: string; escalate_recommended?: boolean };
      if (
        toolUse.name !== "escalate_to_owner" &&
        (resultRecord.error || resultRecord.escalate_recommended || resultRecord.ok === false)
      ) {
        const fallback = await escalateToOwner(conversationId, {
          reason_code: "out_of_scope",
          conversation_summary: `Tool ${toolUse.name} could not safely resolve the customer request: ${resultRecord.error ?? "unknown tool failure"}. Customer message: ${latestInboundText ?? "unknown"}`,
          urgency: "high",
        });
        return {
          texts: [fallback.customer_message],
          mediaIds,
          escalated: true,
          paymentLinks,
          toolRounds,
        };
      }

      if (toolUse.name === "get_vehicle_photos") {
        const photos = result as { media_ids?: string[] };
        if (photos.media_ids?.length) {
          mediaIds.push(...photos.media_ids);
        }
      }
      if (toolUse.name === "generate_payment_link") {
        const link = result as {
          ok?: boolean;
          payment_link_url?: string;
          amount?: number;
          currency?: string;
        };
        if (link.ok && link.payment_link_url && link.currency && typeof link.amount === "number") {
          paymentLinks.push({
            url: link.payment_link_url,
            amount: link.amount,
            currency: link.currency,
          });
        }
      }
      if (toolUse.name === "escalate_to_owner") {
        const esc = result as { ok?: boolean };
        if (esc.ok) escalated = true;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    claudeMessages.push({ role: "assistant", content: response.content });
    claudeMessages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: AGENT_TOOLS,
      messages: claudeMessages,
    });
  }

  const texts = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean);

  const needsVerifiedFact = Boolean(latestInboundText && requiresAuthoritativeTool(latestInboundText));
  const usedAuthoritativeSource = [...usedTools].some((name) => AUTHORITATIVE_TOOLS.has(name));
  const requiredSources = requiredAuthoritativeTools(latestInboundText ?? "");
  const usedRelevantSource = requiredSources.size === 0 || [...requiredSources].some((name) => usedTools.has(name));
  const clarifyingOnly = texts.length > 0 && texts.every((text) =>
    text.split(/(?<=[.!?])\s+/).filter(Boolean).every((sentence) => sentence.trim().endsWith("?")),
  );
  if (needsVerifiedFact && (!usedAuthoritativeSource || !usedRelevantSource) && !clarifyingOnly && !escalated) {
    const fallback = await escalateToOwner(conversationId, {
      reason_code: "out_of_scope",
      conversation_summary: `A factual customer request lacked a verified tool result: ${latestInboundText ?? "unknown request"}`,
      urgency: "high",
    });
    return { texts: [fallback.customer_message ?? "Let me verify that with the team and get right back to you."], mediaIds, escalated: true, paymentLinks, toolRounds };
  }

  if (texts.length === 0 && !escalated) {
    const fallback = await escalateToOwner(conversationId, {
      reason_code: "out_of_scope",
      conversation_summary:
        "Agent produced no text reply after tool use; escalating by default.",
      urgency: "high",
    });
    escalated = true;
    return {
      texts: [fallback.customer_message ?? "Let me check on that and get right back to you."],
      mediaIds,
      escalated,
      paymentLinks,
      toolRounds,
    };
  }

  if (history.length >= HISTORY_LIMIT) {
    const digest = history
      .slice(0, 8)
      .map((m) => `${m.direction}: ${decryptPii(m.content) ?? "[media]"}`)
      .join(" | ")
      .slice(0, 1500);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary: encryptPii(conversationSummary ? `${conversationSummary}\n${digest}`.slice(0, 4000) : digest),
      },
    });
  }

  // Prefer CTA buttons for payment URLs; strip raw Stripe URLs from text replies.
  const cleanedTexts = texts.map((text) =>
    paymentLinks.reduce(
      (acc, link) => acc.split(link.url).join("the payment button below"),
      text,
    ),
  );

  return {
    texts: cleanedTexts,
    mediaIds: [...new Set(mediaIds)],
    escalated,
    paymentLinks,
    toolRounds,
  };
}

async function inboundMessageContent(
  message: {
    attachments: Array<{ mediaType: string; mimeType: string | null; storageKey: string | null; status: string }>;
  },
  text: string,
): Promise<Anthropic.ContentBlockParam[]> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const attachment of message.attachments.slice(0, 4)) {
    if (attachment.status !== "READY" || !attachment.storageKey || !attachment.mimeType?.startsWith("image/")) continue;
    const stored = await readStoredObject(attachment.storageKey);
    if (!stored || stored.bytes.length > 5_000_000) continue;
    const mediaType = stored.contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) continue;
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: stored.bytes.toString("base64") } });
  }
  content.push({ type: "text", text: text || "The customer sent the attached image. Describe only what is visibly present. Use database tools for every business fact, price, availability, policy, date, or vehicle identity." });
  return content;
}
