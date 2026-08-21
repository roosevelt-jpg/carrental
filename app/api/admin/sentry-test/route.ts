import { NextResponse } from "next/server";
import { isSession, requireSession } from "@/lib/auth/guards";
import { captureException } from "@/lib/observability/sentry";

/** Deliberate error for go-live Sentry verification. */
export async function POST() {
  const session = await requireSession("OWNER");
  if (!isSession(session)) return session;

  const error = new Error("Intentional Sentry test error from /api/admin/sentry-test");
  captureException(error, { source: "sentry-test", actor: session.email });
  return NextResponse.json({
    ok: true,
    detail: process.env.SENTRY_DSN
      ? "Exception captured (check Sentry)"
      : "SENTRY_DSN not set — logged locally only",
  });
}
