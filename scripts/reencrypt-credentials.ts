import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Re-encrypt IntegrationCredential rows after rotating ENCRYPTION_KEY.
 *
 * Usage:
 *   OLD_ENCRYPTION_KEY=<old> ENCRYPTION_KEY=<new> npx tsx scripts/reencrypt-credentials.ts
 */
function parseKey(raw: string, label: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const fromBase64 = Buffer.from(raw, "base64");
  if (fromBase64.length === 32) return fromBase64;
  throw new Error(`${label} must be 32 bytes (64 hex chars or base64)`);
}

function decrypt(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

async function main() {
  const oldRaw = process.env.OLD_ENCRYPTION_KEY;
  const newRaw = process.env.ENCRYPTION_KEY;
  if (!oldRaw || !newRaw) {
    throw new Error("Set OLD_ENCRYPTION_KEY and ENCRYPTION_KEY");
  }
  const oldKey = parseKey(oldRaw, "OLD_ENCRYPTION_KEY");
  const newKey = parseKey(newRaw, "ENCRYPTION_KEY");

  const prisma = new PrismaClient();
  const rows = await prisma.integrationCredential.findMany();
  let updated = 0;
  for (const row of rows) {
    const plaintext = decrypt(row.valueEncrypted, oldKey);
    await prisma.integrationCredential.update({
      where: { id: row.id },
      data: { valueEncrypted: encrypt(plaintext, newKey) },
    });
    updated += 1;
  }
  await prisma.$disconnect();
  console.log(JSON.stringify({ msg: "reencrypt_complete", updated }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
