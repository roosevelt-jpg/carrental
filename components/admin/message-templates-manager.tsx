"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Template = {
  id: string;
  name: string;
  purpose: string;
  language: string;
  status: string;
  metaTemplateName: string | null;
  notes: string | null;
};

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;

export function MessageTemplatesManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function update(id: string, patch: Record<string, string | null>) {
    setError(null);
    const res = await fetch(`/api/admin/message-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {templates.map((template) => (
        <article key={template.id} className="rounded-xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-gold-2">{template.name}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-muted">
                {template.purpose} · {template.language}
              </p>
            </div>
            <select
              value={template.status}
              onChange={(e) => update(template.id, { status: e.target.value })}
              className="w-auto"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-sm text-muted">{template.notes}</p>
          <div className="mt-4">
            <label htmlFor={`meta-${template.id}`}>Meta template name</label>
            <input
              id={`meta-${template.id}`}
              defaultValue={template.metaTemplateName ?? ""}
              placeholder="Exact name approved in Meta"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (template.metaTemplateName ?? "")) {
                  update(template.id, { metaTemplateName: value || null });
                }
              }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
