import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient, getClaudeModelId } from "@/lib/integrations/claude-client";

const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
export const KNOWLEDGE_DOCUMENT_TYPES = new Set([...TEXT_TYPES, "application/pdf"]);

export function resolveKnowledgeMimeType(fileName: string, reportedType: string) {
  if (KNOWLEDGE_DOCUMENT_TYPES.has(reportedType)) return reportedType;
  const extension = fileName.toLowerCase().split(".").pop();
  return ({ pdf: "application/pdf", txt: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv", json: "application/json" } as Record<string, string>)[extension ?? ""] ?? reportedType;
}

export function documentChecksum(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function extractKnowledgeContent(bytes: Buffer, mimeType: string, fileName: string) {
  if (TEXT_TYPES.has(mimeType)) {
    const text = bytes.toString("utf8").replace(/\u0000/g, "").trim();
    if (!text) throw new Error("The document does not contain readable text");
    return text.slice(0, 120_000);
  }
  if (mimeType !== "application/pdf") throw new Error("Unsupported document type");
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The uploaded file is not a valid PDF");

  const [client, model] = await Promise.all([getClaudeClient(), getClaudeModelId()]);
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "document",
      title: fileName,
      source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
    },
    {
      type: "text",
      text: "Extract the factual business content from this document faithfully. Preserve headings, tables, prices, dates, conditions, and exceptions. Do not summarize, infer, correct, or add information. Return plain text only.",
    },
  ];
  const response = await client.messages.create({ model, max_tokens: 8_000, messages: [{ role: "user", content }] });
  const text = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("\n").trim();
  if (!text) throw new Error("No readable text could be extracted from the PDF");
  return text.slice(0, 120_000);
}
