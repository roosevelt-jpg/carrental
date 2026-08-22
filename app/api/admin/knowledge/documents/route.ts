import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSession, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { extractKnowledgeContent, documentChecksum, KNOWLEDGE_DOCUMENT_TYPES, resolveKnowledgeMimeType } from "@/lib/knowledge/documents";
import { uploadKnowledgeDocument } from "@/lib/storage/object-storage";

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  keywords: z.string().max(1_000).default(""),
  expiresAt: z.string().max(40).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const form = await request.formData();
  const file = form.get("file");
  const parsed = metadataSchema.safeParse({ title: form.get("title"), category: form.get("category") || "General", keywords: form.get("keywords") || "", expiresAt: form.get("expiresAt") || undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document details" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload" }, { status: 400 });
  const mimeType = resolveKnowledgeMimeType(file.name, file.type);
  if (!KNOWLEDGE_DOCUMENT_TYPES.has(mimeType)) return NextResponse.json({ error: "Use PDF, TXT, Markdown, CSV, or JSON" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Document must be under 8MB" }, { status: 400 });
  const expiresAt = parsed.data.expiresAt ? new Date(`${parsed.data.expiresAt}T23:59:59.999Z`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = documentChecksum(bytes);
  const duplicate = await prisma.knowledgeDocument.findFirst({ where: { checksum, status: { not: "ARCHIVED" } }, select: { id: true, title: true } });
  if (duplicate) return NextResponse.json({ error: `This file already exists as “${duplicate.title}”`, documentId: duplicate.id }, { status: 409 });
  const uploaded = await uploadKnowledgeDocument({ bytes, contentType: mimeType, originalName: file.name });
  let content = ""; let errorMessage: string | null = null;
  try { content = await extractKnowledgeContent(bytes, mimeType, file.name); } catch (error) { errorMessage = error instanceof Error ? error.message : "Content extraction failed"; }
  const document = await prisma.knowledgeDocument.create({ data: {
    title: parsed.data.title, category: parsed.data.category,
    keywords: parsed.data.keywords.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30),
    content, fileName: file.name, fileUrl: uploaded.url, mimeType, checksum,
    status: errorMessage ? "FAILED" : "DRAFT", errorMessage, expiresAt,
  } });
  await writeAuditLog({ actor: session, entityType: "KnowledgeDocument", entityId: document.id, action: "upload", summary: `Uploaded training document: ${document.title}`, after: { ...document, checksum: "[recorded]" } });
  return NextResponse.json({ document }, { status: 201 });
}

export const maxDuration = 60;
