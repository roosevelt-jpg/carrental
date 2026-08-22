import { NextRequest, NextResponse } from "next/server";
import { isSession, requireSession } from "@/lib/auth/guards";
import { getLiveAnalytics } from "@/lib/analytics/live-dashboard";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await requireSession("STAFF"); if (!isSession(session)) return session;
  const days = Number(request.nextUrl.searchParams.get("days") || 30);
  return NextResponse.json(await getLiveAnalytics(days), { headers: { "cache-control": "no-store" } });
}
