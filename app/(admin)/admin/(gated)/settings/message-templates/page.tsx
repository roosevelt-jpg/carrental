import { MessageTemplatesManager } from "@/components/admin/message-templates-manager";
import { prisma } from "@/lib/db";

export default async function MessageTemplatesPage() {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { purpose: "asc" },
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Message templates</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Track Meta approval for outside-24h messaging. Submit templates in Meta Business Manager,
        then mark status here. The agent will not invent template names.
      </p>
      <MessageTemplatesManager
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          purpose: t.purpose,
          language: t.language,
          status: t.status,
          metaTemplateName: t.metaTemplateName,
          notes: t.notes,
        }))}
      />
    </div>
  );
}
