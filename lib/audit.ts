import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth/session";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(params: {
  actor?: SessionPayload | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actor?.userId ?? null,
      actorEmail: params.actor?.email ?? null,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      action: params.action,
      summary: params.summary,
      beforeJson: toJson(params.before),
      afterJson: toJson(params.after),
    },
  });
}
