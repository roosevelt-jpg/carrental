import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth/session";

const ROLE_RANK: Record<UserRole, number> = {
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasMinRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export async function requireSession(
  minRole: UserRole = "STAFF",
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinRole(session.role, minRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export function isSession(
  value: SessionPayload | NextResponse,
): value is SessionPayload {
  return !(value instanceof NextResponse);
}
