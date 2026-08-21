import {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { getAppBaseUrl } from "@/lib/env";

function s3Configured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY,
  );
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

export function isObjectStorageConfigured() {
  return s3Configured();
}

export async function uploadVehiclePhoto(params: {
  vehicleId: string;
  bytes: Buffer;
  contentType: string;
  originalName: string;
}): Promise<{ url: string; key: string }> {
  const ext = extensionFor(params.contentType, params.originalName);
  const key = `vehicles/${params.vehicleId}/${randomUUID()}${ext}`;

  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET!;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.bytes,
        ContentType: params.contentType,
      }),
    );
    const base = (process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT!).replace(
      /\/$/,
      "",
    );
    const url = process.env.S3_PUBLIC_BASE_URL
      ? `${base}/${key}`
      : `${base}/${bucket}/${key}`;
    return { url, key };
  }

  // Local fallback when S3 env is not set yet — still real files, not mocked media IDs.
  const dir = path.join(process.cwd(), "public", "uploads", "vehicles", params.vehicleId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), params.bytes);
  return {
    url: `${getAppBaseUrl()}/uploads/vehicles/${params.vehicleId}/${filename}`,
    key: `local:${params.vehicleId}/${filename}`,
  };
}

export async function deleteStoredObject(urlOrKey: string) {
  if (urlOrKey.startsWith("local:") || urlOrKey.includes("/uploads/vehicles/")) {
    const relative = urlOrKey.includes("/uploads/")
      ? urlOrKey.split("/uploads/")[1]
      : urlOrKey.replace(/^local:/, "vehicles/");
    const filePath = path.join(process.cwd(), "public", "uploads", relative);
    try {
      await unlink(filePath);
    } catch {
      // ignore missing file
    }
    return;
  }

  if (!s3Configured()) return;
  const bucket = process.env.S3_BUCKET!;
  const key = urlOrKey.includes(bucket)
    ? urlOrKey.split(`${bucket}/`).pop()!
    : urlOrKey.replace(/^https?:\/\/[^/]+\//, "");
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}

function extensionFor(contentType: string, originalName: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  const fromName = path.extname(originalName);
  return fromName || ".jpg";
}
