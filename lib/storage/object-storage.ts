import {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { getAppBaseUrl } from "@/lib/env";

export type StorageBackend = "s3" | "local";

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
    region: "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

/** S3-compatible storage is the production backend; local disk is development-only. */
export function getStorageBackend(): StorageBackend {
  if (s3Configured()) return "s3";
  return "local";
}

export function isObjectStorageConfigured() {
  return getStorageBackend() !== "local";
}

export async function uploadVehiclePhoto(params: {
  vehicleId: string;
  bytes: Buffer;
  contentType: string;
  originalName: string;
}): Promise<{ url: string; key: string }> {
  const ext = extensionFor(params.contentType, params.originalName);
  const key = `vehicles/${params.vehicleId}/${randomUUID()}${ext}`;
  const backend = getStorageBackend();

  if (backend === "s3") {
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
    const base = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    const url = `${base}/${bucket}/${key}`;
    return { url, key };
  }

  // Local fallback when S3 is not set — real files, not mocked media IDs.
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "vehicles",
    params.vehicleId,
  );
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), params.bytes);
  return {
    url: `${getAppBaseUrl()}/uploads/vehicles/${params.vehicleId}/${filename}`,
    key: `local:${params.vehicleId}/${filename}`,
  };
}

export async function uploadCmsAsset(params: {
  bytes: Buffer;
  contentType: string;
  originalName: string;
}): Promise<{ url: string; key: string }> {
  const ext = extensionFor(params.contentType, params.originalName);
  const key = `cms/${randomUUID()}${ext}`;
  const backend = getStorageBackend();

  if (backend === "s3") {
    const bucket = process.env.S3_BUCKET!;
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.bytes,
        ContentType: params.contentType,
      }),
    );
    const base = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    return {
      url: `${base}/${bucket}/${key}`,
      key,
    };
  }

  const dir = path.join(process.cwd(), "public", "uploads", "cms");
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, filename), params.bytes);
  return {
    url: `${getAppBaseUrl()}/uploads/cms/${filename}`,
    key: `local:cms/${filename}`,
  };
}

export async function uploadKnowledgeDocument(params: {
  bytes: Buffer;
  contentType: string;
  originalName: string;
}): Promise<{ url: string; key: string }> {
  const safeExtension = path.extname(params.originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10) || ".txt";
  const key = `knowledge/${randomUUID()}${safeExtension}`;
  const backend = getStorageBackend();

  if (backend === "s3") {
    const bucket = process.env.S3_BUCKET!;
    await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: params.bytes, ContentType: params.contentType }));
    const base = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    return { url: `${base}/${bucket}/${key}`, key };
  }

  const dir = path.join(process.cwd(), "public", "uploads", "knowledge");
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${safeExtension}`;
  await writeFile(path.join(dir, filename), params.bytes);
  return { url: `${getAppBaseUrl()}/uploads/knowledge/${filename}`, key: `local:knowledge/${filename}` };
}

export async function deleteStoredObject(urlOrKey: string) {
  if (urlOrKey.startsWith("local:") || urlOrKey.includes("/uploads/vehicles/") || urlOrKey.includes("/uploads/knowledge/")) {
    const relative = urlOrKey.includes("/uploads/")
      ? urlOrKey.split("/uploads/")[1]
      : urlOrKey.startsWith("local:knowledge/")
        ? urlOrKey.replace(/^local:/, "")
        : `vehicles/${urlOrKey.replace(/^local:/, "")}`;
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
