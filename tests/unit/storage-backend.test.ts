import { describe, expect, it, afterEach } from "vitest";
import { getStorageBackend } from "@/lib/storage/object-storage";

const keys = [
  "BLOB_READ_WRITE_TOKEN",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
] as const;

const snapshot: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

function capture() {
  for (const key of keys) snapshot[key] = process.env[key];
}

function clearAll() {
  for (const key of keys) delete process.env[key];
}

describe("getStorageBackend", () => {
  it("prefers Vercel Blob when token is present", () => {
    capture();
    clearAll();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    expect(getStorageBackend()).toBe("vercel-blob");
  });

  it("falls back to s3 then local", () => {
    capture();
    clearAll();
    expect(getStorageBackend()).toBe("local");
    process.env.S3_ENDPOINT = "https://example.com";
    process.env.S3_BUCKET = "fleet";
    process.env.S3_ACCESS_KEY = "ak";
    process.env.S3_SECRET_KEY = "sk";
    expect(getStorageBackend()).toBe("s3");
  });
});
