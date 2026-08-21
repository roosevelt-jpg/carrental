import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setCredential } from "@/lib/settings/settings-service";
import { isSession, requireSession } from "@/lib/auth/guards";
import { PROVIDER_KEYS, type Provider } from "@/lib/integrations/constants";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  provider: z.enum(["whatsapp", "anthropic", "stripe"]),
  values: z.record(z.string(), z.string()),
});

export async function PUT(request: NextRequest) {
  const session = await requireSession("ADMIN");
  if (!isSession(session)) {
    return session;
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const allowed = new Set<string>(PROVIDER_KEYS[parsed.data.provider as Provider]);
  const updatedKeys: string[] = [];
  for (const [key, value] of Object.entries(parsed.data.values)) {
    if (!allowed.has(key)) {
      return NextResponse.json({ error: `Unknown key: ${key}` }, { status: 400 });
    }
    if (value.trim()) {
      await setCredential(parsed.data.provider, key, value);
      updatedKeys.push(key);
    }
  }

  if (updatedKeys.length > 0) {
    await writeAuditLog({
      actor: session,
      entityType: "IntegrationCredential",
      entityId: parsed.data.provider,
      action: "update",
      summary: `Updated ${parsed.data.provider} credentials (${updatedKeys.join(", ")})`,
      after: { provider: parsed.data.provider, keys: updatedKeys },
    });
  }

  return NextResponse.json({ ok: true });
}
