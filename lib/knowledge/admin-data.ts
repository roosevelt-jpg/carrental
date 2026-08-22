import { prisma } from "@/lib/db";

export async function getKnowledgeAdminData() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [documents, entries, queryCount, missedQueries] = await Promise.all([
    prisma.knowledgeDocument.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.knowledgeEntry.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }] }),
    prisma.knowledgeQueryLog.count({ where: { createdAt: { gte: since } } }),
    prisma.knowledgeQueryLog.count({ where: { createdAt: { gte: since }, found: false } }),
  ]);
  return { documents, entries, stats: { queryCount, missedQueries } };
}
