import { NextRequest, NextResponse } from "next/server";
import { isSession, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { uploadCmsAsset } from "@/lib/storage/object-storage";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Profile image is required" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use JPEG, PNG, or WebP" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  const uploaded = await uploadCmsAsset({ bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type, originalName: file.name });
  const user = await prisma.user.update({ where: { id: session.userId }, data: { avatarUrl: uploaded.url }, select: { avatarUrl: true } });
  await writeAuditLog({ actor: session, entityType: "UserProfile", entityId: session.userId, action: "avatar_upload", summary: "Updated profile picture", after: { avatarUrl: uploaded.url, storageKey: uploaded.key } });
  return NextResponse.json(user, { status: 201 });
}
