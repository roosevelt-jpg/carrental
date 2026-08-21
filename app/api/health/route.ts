import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/env";
import { getStorageBackend } from "@/lib/storage/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const checks: Record<string, "ok" | "error" | "warn" | "missing"> = {
    app: "ok",
    database: "missing",
    redis: "missing",
    storage: "warn",
  };

  if (process.env.DATABASE_URL) {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 2500);
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
  }

  if (process.env.REDIS_URL) {
    try {
      const IORedis = (await import("ioredis")).default;
      const redis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      try {
        await withTimeout(redis.connect().then(() => redis.ping()), 2500);
        checks.redis = "ok";
      } finally {
        redis.disconnect();
      }
    } catch {
      checks.redis = "error";
    }
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
      hint:
        ok
          ? undefined
          : "Set DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, SESSION_SECRET, APP_BASE_URL on the Vercel drivn project (Production), then redeploy. Run a separate worker against the same Redis.",
    },
    { status: ok ? 200 : 503 },
  );
}
