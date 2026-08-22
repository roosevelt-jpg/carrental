import { KnowledgeBaseManager } from "@/components/admin/knowledge-base-manager";
import { getKnowledgeAdminData } from "@/lib/knowledge/admin-data";

export default async function KnowledgeBasePage() {
  const { documents, entries, stats } = await getKnowledgeAdminData();
  return <KnowledgeBaseManager documents={JSON.parse(JSON.stringify(documents))} entries={JSON.parse(JSON.stringify(entries))} stats={stats} />;
}
