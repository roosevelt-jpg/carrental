import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { translateTexts } from "@/lib/i18n/translate";
import { getRedisConnection } from "@/lib/queue/connection";

const requestSchema = z.object({
  locale: z.string().min(2).max(12).refine(isSupportedLocale, "Unsupported locale"),
  texts: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
}).refine((value) => value.texts.join("").length <= 8_000, "Translation batch is too large");

export async function POST(request: NextRequest) {
  const limited = await isRateLimited(request);
  if (limited) {
    return NextResponse.json({ error: "Too many translation requests" }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid translation request" },
      { status: 400 },
    );
  }

  try {
    const translations = await translateTexts(parsed.data.texts, parsed.data.locale);
    return NextResponse.json({ translations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed";
    const notConfigured = message.includes("not configured");
    return NextResponse.json(
      {
        error: notConfigured ? "Configure Claude in Admin → Integrations to enable translation" : message,
        translations: parsed.data.texts,
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
}

async function isRateLimited(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  try {
    const redis = getRedisConnection();
    const key = `i18n:rate:${address}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count > 30;
  } catch {
    return false;
  }
}
