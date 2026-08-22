import "dotenv/config";
import { prisma } from "../lib/db/index";
import { decryptPii, encryptPii, piiLookupHash } from "../lib/privacy/pii";

async function main() {
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    const whatsappId = decryptPii(customer.whatsappId);
    if (!whatsappId) continue;
    await prisma.customer.update({ where: { id: customer.id }, data: { whatsappId: encryptPii(whatsappId)!, whatsappIdHash: piiLookupHash(whatsappId), name: encryptPii(decryptPii(customer.name)) } });
  }
  const messages = await prisma.message.findMany();
  for (const row of messages) await prisma.message.update({ where: { id: row.id }, data: { content: encryptPii(decryptPii(row.content)), ...(row.agentReply ? { agentReply: encryptPii(typeof row.agentReply === "string" ? decryptPii(row.agentReply) ?? row.agentReply : JSON.stringify(row.agentReply))! } : {}) } });
  const conversations = await prisma.conversation.findMany({ where: { summary: { not: null } } });
  for (const row of conversations) await prisma.conversation.update({ where: { id: row.id }, data: { summary: encryptPii(decryptPii(row.summary)) } });
  const escalations = await prisma.escalation.findMany();
  for (const row of escalations) await prisma.escalation.update({ where: { id: row.id }, data: { contextSummary: encryptPii(decryptPii(row.contextSummary))!, suggestedReply: encryptPii(decryptPii(row.suggestedReply)), ownerReply: encryptPii(decryptPii(row.ownerReply)) } });
  const queries = await prisma.knowledgeQueryLog.findMany();
  for (const row of queries) await prisma.knowledgeQueryLog.update({ where: { id: row.id }, data: { query: encryptPii(decryptPii(row.query))! } });
  const webhookEvents = await prisma.whatsAppWebhookEvent.findMany();
  for (const row of webhookEvents) await prisma.whatsAppWebhookEvent.update({ where: { id: row.id }, data: { payload: encryptPii(typeof row.payload === "string" ? decryptPii(row.payload) ?? row.payload : JSON.stringify(row.payload))! } });
}

main().finally(() => prisma.$disconnect());
