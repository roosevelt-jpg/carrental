import { isSession, requireSession } from "@/lib/auth/guards";
import { decodeBlobPath, readPrivateBlob } from "@/lib/storage/object-storage";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { token } = await params;
  const pathname = decodeBlobPath(token);
  if (!pathname || (!pathname.startsWith("knowledge/") && !pathname.startsWith("inbound/"))) {
    return new Response("Not found", { status: 404 });
  }

  const result = await readPrivateBlob(pathname, request.headers.get("if-none-match"), request.headers.get("range"));
  if (!result) return new Response("Not found", { status: 404 });
  if (result.statusCode === 304) return new Response(null, { status: 304 });
  const inline = /^(image|video|audio)\//.test(result.blob.contentType);

  const contentRange = result.headers.get("content-range");
  return new Response(result.stream, {
    status: contentRange ? 206 : 200,
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": result.headers.get("content-length") || String(result.blob.size),
      ...(contentRange ? { "Content-Range": contentRange, "Accept-Ranges": "bytes" } : {}),
      ETag: result.blob.etag,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": inline ? "inline" : result.blob.contentDisposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
