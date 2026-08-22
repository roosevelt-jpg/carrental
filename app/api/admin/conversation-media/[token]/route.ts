import { isSession, requireSession } from "@/lib/auth/guards";
import { readStoredObject } from "@/lib/storage/object-storage";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { token } = await params;
  let key: string;
  try {
    key = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!(key.startsWith("inbound/") || key.startsWith("local:inbound/")) || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const stored = await readStoredObject(key);
  if (!stored) return new Response("Not found", { status: 404 });

  const range = parseRange(request.headers.get("range"), stored.bytes.length);
  const body = range ? stored.bytes.subarray(range.start, range.end + 1) : stored.bytes;
  return new Response(Uint8Array.from(body), {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": String(body.length),
      "Content-Disposition": /^(image|video|audio)\//.test(stored.contentType) ? "inline" : "attachment",
      "Cache-Control": "private, max-age=300",
      "Accept-Ranges": "bytes",
      ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${stored.bytes.length}` } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseRange(value: string | null, size: number) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}
