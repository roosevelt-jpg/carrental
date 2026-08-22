import { notFound } from "next/navigation";
import { ConversationActions } from "@/components/admin/conversation-actions";
import { prisma } from "@/lib/db";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { decryptPii } from "@/lib/privacy/pii";
import Image from "next/image";

type Params = { params: Promise<{ id: string }> };

export default async function ConversationDetailPage({ params }: Params) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: "asc" }, include: { attachments: { orderBy: { createdAt: "asc" } } } },
      escalations: { orderBy: { createdAt: "desc" } },
      outcome: true,
    },
  });
  if (!conversation) notFound();

  return (
    <div>
      <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-[0.22em] text-gold">Conversation</p><LiveRefresh intervalMs={3000} /></div>
      <h1 className="mt-2 font-serif text-4xl">{decryptPii(conversation.customer.whatsappId)}</h1>
      <p className="mt-2 text-sm text-muted">
        {conversation.status} · started {conversation.startedAt.toLocaleString()}
      </p>

      <div className="mt-6 max-w-xl">
        <ConversationActions
          conversationId={conversation.id}
          status={conversation.status}
          currentOutcome={conversation.outcome?.outcome ?? null}
        />
      </div>

      <div className="mt-8 space-y-3">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-2xl rounded-xl border border-line p-4 ${
              message.direction === "IN" ? "bg-panel-2" : "bg-panel ml-auto"
            }`}
          >
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {message.direction} · {message.type} · {message.sentAt.toLocaleString()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {decryptPii(message.content) ?? (message.mediaIds.length ? "[media]" : "")}
            </p>
            {message.attachments.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {message.attachments.map((attachment) => (
                  <ConversationAttachment
                    key={attachment.id}
                    attachment={{
                      mediaType: attachment.mediaType,
                      mimeType: attachment.mimeType,
                      storageUrl: attachment.storageUrl,
                      fileName: decryptPii(attachment.fileName),
                      fileSize: attachment.fileSize,
                      status: attachment.status,
                      errorMessage: decryptPii(attachment.errorMessage),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConversationAttachment({ attachment }: { attachment: {
  mediaType: string;
  mimeType: string | null;
  storageUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  errorMessage: string | null;
} }) {
  if (attachment.status !== "READY" || !attachment.storageUrl) {
    return <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-danger">Attachment unavailable for secure preview{attachment.errorMessage ? `: ${attachment.errorMessage}` : "."}</div>;
  }
  const description = attachment.fileName || `${attachment.mediaType} attachment`;
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-black/20">
      {attachment.mimeType?.startsWith("image/") ? (
        <a href={attachment.storageUrl} target="_blank" rel="noreferrer" className="block">
          <Image src={attachment.storageUrl} alt={description} width={900} height={675} sizes="(max-width: 768px) 100vw, 420px" unoptimized className="h-auto max-h-[34rem] w-full object-contain" />
        </a>
      ) : attachment.mimeType?.startsWith("video/") ? (
        <video controls preload="metadata" className="max-h-[34rem] w-full" src={attachment.storageUrl}>Your browser does not support video playback.</video>
      ) : attachment.mimeType?.startsWith("audio/") ? (
        <audio controls preload="metadata" className="w-full p-3" src={attachment.storageUrl}>Your browser does not support audio playback.</audio>
      ) : (
        <a href={attachment.storageUrl} target="_blank" rel="noreferrer" className="block p-4 text-sm text-gold hover:underline">Open {description}</a>
      )}
      <figcaption className="flex flex-wrap justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-muted">
        <span>{description}</span>
        <span>{attachment.fileSize ? formatBytes(attachment.fileSize) : attachment.mimeType}</span>
      </figcaption>
    </figure>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
