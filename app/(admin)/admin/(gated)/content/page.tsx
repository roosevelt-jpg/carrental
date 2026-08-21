import { prisma } from "@/lib/db";
import { CmsManager } from "@/components/admin/cms-manager";

export default async function ContentStudioPage() {
  const [settings, faqs, knowledge, revisions] = await Promise.all([
    prisma.cmsSettings.upsert({ where: { id: "primary" }, create: { id: "primary" }, update: {} }),
    prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.knowledgeEntry.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] }),
    prisma.cmsRevision.findMany({
      where: { cmsSettingsId: "primary" },
      select: { revision: true, actorEmail: true, createdAt: true },
      orderBy: { revision: "desc" },
      take: 10,
    }),
  ]);
  const {
    id: _id,
    publishedSnapshot: _publishedSnapshot,
    publishedAt: _publishedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...editorSettings
  } = settings;
  void _id;
  void _publishedSnapshot;
  void _publishedAt;
  void _createdAt;
  void _updatedAt;

  return (
    <div>
      <h1 className="font-serif text-4xl">Content studio</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Manage the business identity, public website, AI sales behavior, FAQs, and verified
        knowledge from one audited workspace.
      </p>
      <CmsManager
        settings={JSON.parse(JSON.stringify(editorSettings))}
        faqs={JSON.parse(JSON.stringify(faqs))}
        knowledge={JSON.parse(JSON.stringify(knowledge))}
        revisions={JSON.parse(JSON.stringify(revisions))}
      />
    </div>
  );
}
