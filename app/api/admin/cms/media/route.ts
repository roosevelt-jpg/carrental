import { NextRequest, NextResponse } from "next/server";
import { isSession, requireSession } from "@/lib/auth/guards";
import { uploadCmsAsset } from "@/lib/storage/object-storage";
import { writeAuditLog } from "@/lib/audit";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use JPEG, PNG, WebP, or SVG" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  const uploaded = await uploadCmsAsset({
    bytes: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    originalName: file.name,
  });
  await writeAuditLog({ actor: session, entityType: "CmsAsset", entityId: uploaded.key, action: "upload", summary: `Uploaded CMS asset ${file.name}`, after: uploaded });
  return NextResponse.json(uploaded, { status: 201 });
}
