import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";

export async function GET() {
  const status = await getSetupStatus();
  const session = await getSession();
  if (status.hasUsers && !session) {
    return NextResponse.json({ hasUsers: true, complete: status.complete });
  }
  return NextResponse.json(status);
}
