import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/admin/dashboard";
import { isSession, requireSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;
  return NextResponse.json(await getDashboardData(), { headers: { "cache-control": "no-store" } });
}
