import { MessageTemplatesManager } from "@/components/admin/message-templates-manager";
import { prisma } from "@/lib/db";
import { ensureRequiredMessageTemplateDrafts } from "@/lib/cms/required-message-templates";

export default async function MessageTemplatesPage() {
  await ensureRequiredMessageTemplateDrafts();
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { purpose: "asc" },
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Message templates</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Required template shells contain no sample business content. Author the wording and real
        Meta review samples, then submit directly to Meta. Approval status is synced
        from Meta; approved content is used automatically outside the 24-hour service window.
      </p>
      <MessageTemplatesManager
        templates={JSON.parse(JSON.stringify(templates))}
      />
    </div>
  );
}
