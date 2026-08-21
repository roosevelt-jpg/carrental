import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
import { getRedisConnection } from "@/lib/queue/connection";
import { getStorageBackend } from "@/lib/storage/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error" | "warn"> = {
    app: "ok",
    database: "error",
    redis: "error",
    storage: "warn",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const pong = await getRedisConnection().ping();
    checks.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const storage = getStorageBackend();
  checks.storage = storage === "local" ? "warn" : "ok";

  const ok = checks.database === "ok" && checks.redis === "ok" && checks.app === "ok";
  return NextResponse.json(
    {
      ok,
      baseUrl: getAppBaseUrl(),
      storage,
      webhooks: {
        whatsapp: `${getAppBaseUrl()}/api/webhooks/whatsapp`,
        stripe: `${getAppBaseUrl()}/api/webhooks/stripe`,
      },
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
