import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { testConnection } from "@/lib/settings/settings-service";
import { isSession, requireSession } from "@/lib/auth/guards";

const schema = z.object({
  provider: z.enum(["whatsapp", "anthropic", "stripe"]),
});

export async function POST(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) {
    return session;
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Provider is required" }, { status: 400 });
  }

  const result = await testConnection(parsed.data.provider);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
