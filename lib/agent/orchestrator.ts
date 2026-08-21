import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getClaudeClient, getClaudeModelId } from "@/lib/integrations/claude-client";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { AGENT_TOOLS } from "@/lib/agent/tool-definitions";
import { executeTool } from "@/lib/agent/tools";
import { escalateToOwner } from "@/lib/agent/tools/escalate-to-owner";
import { matchEscalationHint } from "@/lib/agent/escalation-hint";

const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 8;
const HARD_ESCALATION_REASONS = new Set([
  "refund_request",
  "eligibility_exception",
  "fee_dispute",
  "repeated_misunderstanding",
  "explicit_human_request",
]);

export type AgentReply = {
  texts: string[];
  mediaIds: string[];
  escalated: boolean;
  paymentLinks: Array<{ url: string; amount: number; currency: string }>;
  toolRounds: number;
};

export async function runOrchestrator(conversationId: string): Promise<AgentReply> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: "desc" }, take: HISTORY_LIMIT },
      quotes: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const system = await buildSystemPrompt();
  const history = [...conversation.messages].reverse();
  const claudeMessages: Anthropic.MessageParam[] = [];

  if (conversation.summary) {
    claudeMessages.push({
      role: "user",
      content: `Earlier conversation summary: ${conversation.summary}`,
    });
    claudeMessages.push({
      role: "assistant",
      content: "Understood. I will use tools for any factual claim.",
    });
  }

  for (const message of history) {
    if (!message.content && message.mediaIds.length === 0) continue;
    const text =
      message.content ??
      (message.mediaIds.length ? "[media message]" : "");
    if (message.direction === "IN") {
      claudeMessages.push({ role: "user", content: text });
    } else {
      claudeMessages.push({ role: "assistant", content: text });
    }
  }

  const latestInbound = [...history].reverse().find((m) => m.direction === "IN" && m.content);
  const hint = latestInbound?.content
    ? matchEscalationHint(latestInbound.content)
    : null;
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

  if (hint && HARD_ESCALATION_REASONS.has(hint)) {
    const escalation = await escalateToOwner(conversationId, {
      reason_code: hint,
      conversation_summary: latestInbound?.content ?? `Customer request matched ${hint}`,
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
      const result = await executeTool(toolUse.name, toolUse.input, {
        conversationId,
      });

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
        if (link.ok && link.payment_link_url) {
          paymentLinks.push({
            url: link.payment_link_url,
            amount: link.amount ?? 0,
            currency: link.currency ?? "AED",
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
      .map((m) => `${m.direction}: ${m.content ?? "[media]"}`)
      .join(" | ")
      .slice(0, 1500);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary: conversation.summary
          ? `${conversation.summary}\n${digest}`.slice(0, 4000)
          : digest,
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
