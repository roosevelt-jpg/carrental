import { isSession, requireSession } from "@/lib/auth/guards";
import { decodeBlobPath, readPrivateBlob } from "@/lib/storage/object-storage";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const { token } = await params;
  const pathname = decodeBlobPath(token);
  if (!pathname?.startsWith("knowledge/")) {
    return new Response("Not found", { status: 404 });
  }

  const result = await readPrivateBlob(pathname, request.headers.get("if-none-match"));
  if (!result) return new Response("Not found", { status: 404 });
  if (result.statusCode === 304) return new Response(null, { status: 304 });

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      ETag: result.blob.etag,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": result.blob.contentDisposition,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
