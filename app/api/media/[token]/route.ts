import { decodeBlobPath, readPrivateBlob } from "@/lib/storage/object-storage";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const pathname = decodeBlobPath(token);

  if (!pathname || (!pathname.startsWith("vehicles/") && !pathname.startsWith("cms/"))) {
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
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
