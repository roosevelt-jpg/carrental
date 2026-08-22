import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  field: z.enum([
    "metaWebhookConfirmed",
    "stripeWebhookConfirmed",
    "escalationRulesReviewed",
    "stripeModeReviewed",
    "sentryTestConfirmed",
    "ownerUatSignedOff",
  ]),
  confirmed: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) return session;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activation confirmation" }, { status: 400 });
  }
  const before = await prisma.activationReview.findUnique({ where: { id: "primary" } });
  const review = await prisma.activationReview.upsert({
    where: { id: "primary" },
    create: {
      id: "primary",
      [parsed.data.field]: parsed.data.confirmed,
      confirmedByEmail: session.email,
    },
    update: {
      [parsed.data.field]: parsed.data.confirmed,
      confirmedByEmail: session.email,
    },
  });
  await writeAuditLog({
    actor: session,
    entityType: "ActivationReview",
    entityId: review.id,
    action: parsed.data.confirmed ? "confirm" : "reopen",
    summary: `${parsed.data.field} ${parsed.data.confirmed ? "confirmed" : "reopened"}`,
    before,
    after: review,
  });
  return NextResponse.json({ review });
}
