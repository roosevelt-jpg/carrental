import { randomBytes } from "node:crypto";

const encryptionKey = randomBytes(32).toString("hex");
const sessionSecret = randomBytes(48).toString("hex");

console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
