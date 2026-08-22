import { describe, expect, it } from "vitest";
import { AGENT_TOOLS } from "@/lib/agent/tool-definitions";
import { documentChecksum, extractKnowledgeContent, KNOWLEDGE_DOCUMENT_TYPES, resolveKnowledgeMimeType } from "@/lib/knowledge/documents";

describe("knowledge safety", () => {
  it("exposes verified knowledge and exact business time as agent tools", () => {
    const names = AGENT_TOOLS.map((tool) => tool.name);
    expect(names).toContain("search_knowledge");
    expect(names).toContain("get_business_time");
  });

  it("accepts business document formats and extracts text without modification", async () => {
    expect(KNOWLEDGE_DOCUMENT_TYPES).toContain("application/pdf");
    expect(KNOWLEDGE_DOCUMENT_TYPES).toContain("text/markdown");
    expect(resolveKnowledgeMimeType("delivery.md", "")).toBe("text/markdown");
    const source = "Airport delivery fee: AED 250.\nValid until 2026-12-31.";
    await expect(extractKnowledgeContent(Buffer.from(source), "text/markdown", "delivery.md")).resolves.toBe(source);
  });

  it("uses stable checksums to detect duplicate uploads", () => {
    expect(documentChecksum(Buffer.from("verified policy"))).toBe(documentChecksum(Buffer.from("verified policy")));
    expect(documentChecksum(Buffer.from("verified policy"))).not.toBe(documentChecksum(Buffer.from("different policy")));
  });
});
