import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { cmsSettingsPatchSchema } from "@/lib/cms/schemas";
import { snapshotForJson } from "@/lib/cms/content";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;
  const [settings, revisions] = await Promise.all([
    prisma.cmsSettings.upsert({ where: { id: "primary" }, create: { id: "primary" }, update: {} }),
    prisma.cmsRevision.findMany({
      where: { cmsSettingsId: "primary" },
      select: { revision: true, actorEmail: true, createdAt: true },
      orderBy: { revision: "desc" },
      take: 20,
    }),
  ]);
  return NextResponse.json({ settings, revisions });
}

export async function PATCH(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const parsed = cmsSettingsPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid CMS content" },
      { status: 400 },
    );
  }
  const clean = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value === "" ? null : value]),
  );
  const before = await prisma.cmsSettings.upsert({
    where: { id: "primary" },
    create: { id: "primary" },
    update: {},
  });
  if (parsed.data.sitePublished === true) {
    const candidate = { ...before, ...parsed.data };
    const required = [
      "businessName", "businessDescription", "city", "country", "timezone", "currency",
      "seoTitle", "seoDescription", "heroTitle", "heroSubtitle", "aboutTitle", "aboutBody",
      "fleetTitle", "fleetBody", "contactTitle", "contactBody", "footerText", "agentTone",
      "salesScript", "agentGreeting", "agentHandoffMessage", "prohibitedClaims",
    ] as const;
    const missing = required.filter((key) => !String(candidate[key] ?? "").trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Complete the real business content before publishing: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: candidate.timezone }).format();
    } catch {
      return NextResponse.json({ error: "Enter a valid IANA business timezone before publishing" }, { status: 400 });
    }
  }
  const settings = await prisma.$transaction(async (tx) => {
    let updated = await tx.cmsSettings.update({
      where: { id: "primary" },
      data: {
        ...clean,
        revision: { increment: 1 },
        ...(parsed.data.sitePublished === true ? { publishedAt: new Date() } : {}),
      },
    });
    if (parsed.data.sitePublished === true) {
      const { publishedSnapshot: _previousSnapshot, ...publishable } = updated;
      void _previousSnapshot;
      const snapshot = snapshotForJson(publishable);
      updated = await tx.cmsSettings.update({
        where: { id: "primary" },
        data: { publishedSnapshot: snapshot },
      });
    }
    await tx.cmsRevision.create({
      data: {
        cmsSettingsId: updated.id,
        revision: updated.revision,
        snapshot: snapshotForJson(updated),
        actorEmail: session.email,
      },
    });
    return updated;
  });
  await writeAuditLog({
    actor: session,
    entityType: "CmsSettings",
    entityId: settings.id,
    action: parsed.data.sitePublished === true ? "publish" : "update",
    summary: `Updated CMS content to revision ${settings.revision}`,
    before,
    after: settings,
  });
  return NextResponse.json({ settings });
}
