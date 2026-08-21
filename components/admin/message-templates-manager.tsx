"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Template = {
  id: string;
  name: string;
  purpose: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  status: string;
  metaTemplateName: string | null;
  metaTemplateId: string | null;
  bodyText: string;
  bodyVariables: string[];
  sampleValues: string[];
  headerText: string | null;
  footerText: string | null;
  buttonType: "NONE" | "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  buttonText: string | null;
  buttonValue: string | null;
  rejectionReason: string | null;
  lastSubmittedAt: string | null;
  notes: string | null;
};

export function MessageTemplatesManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function syncFromMeta() {
    setSyncing(true); setError(null); setMessage(null);
    const response = await fetch("/api/admin/message-templates", { method: "POST" });
    const body = await response.json(); setSyncing(false);
    if (!response.ok) return setError(body.error ?? "Could not sync templates from Meta");
    setMessage(`Synchronized ${body.updated} template${body.updated === 1 ? "" : "s"} from Meta.`);
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">
        <p className="text-sm text-muted">Meta reviews every new or materially edited template. The app never marks a template approved by itself.</p>
        <button className="btn-ghost" type="button" disabled={syncing} onClick={syncFromMeta}>{syncing ? "Syncing…" : "Sync statuses from Meta"}</button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
      {templates.map((template) => <TemplateEditor key={`${template.id}-${template.status}-${template.bodyText}`} initial={template} onError={setError} onMessage={setMessage} />)}
    </div>
  );
}

function TemplateEditor({ initial, onError, onMessage }: { initial: Template; onError: (value: string | null) => void; onMessage: (value: string | null) => void }) {
  const router = useRouter();
  const [template, setTemplate] = useState(initial);
  const [busy, setBusy] = useState(false);
  const variables = extractVariables(template.bodyText);
  const sampleMap = Object.fromEntries(initial.bodyVariables.map((name, index) => [name, template.sampleValues[index] ?? ""]));

  function updateBody(bodyText: string) {
    const nextVariables = extractVariables(bodyText);
    const previousMap = Object.fromEntries(variables.map((name, index) => [name, template.sampleValues[index] ?? ""]));
    setTemplate({ ...template, bodyText, bodyVariables: nextVariables, sampleValues: nextVariables.map((name) => previousMap[name] ?? sampleMap[name] ?? "") });
  }

  async function save() {
    setBusy(true); onError(null); onMessage(null);
    const response = await fetch(`/api/admin/message-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metaTemplateName: template.metaTemplateName || template.name,
        language: template.language,
        category: template.category,
        bodyText: template.bodyText,
        sampleValues: template.sampleValues,
        headerText: template.headerText || null,
        footerText: template.footerText || null,
        buttonType: template.buttonType,
        buttonText: template.buttonType === "NONE" ? null : template.buttonText,
        buttonValue: template.buttonType === "URL" || template.buttonType === "PHONE_NUMBER" ? template.buttonValue : null,
        notes: template.notes,
      }),
    });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { onError(body.error ?? "Template save failed"); return false; }
    setTemplate(body.template); onMessage(`${template.name} saved as a draft.`); router.refresh(); return true;
  }

  async function publish() {
    if (!(await save())) return;
    setBusy(true); onError(null); onMessage(null);
    const response = await fetch(`/api/admin/message-templates/${template.id}/publish`, { method: "POST" });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return onError(body.error ?? "Meta submission failed");
    setTemplate(body.template); onMessage(`${body.template.metaTemplateName} submitted to Meta for review.`); router.refresh();
  }

  return (
    <article className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-mono text-sm text-gold-2">{template.name}</p><p className="mt-1 text-xs uppercase tracking-widest text-muted">{template.purpose}</p></div>
        <div className="text-right"><StatusBadge status={template.status} />{template.lastSubmittedAt ? <p className="mt-2 text-xs text-muted">Submitted {new Date(template.lastSubmittedAt).toLocaleString()}</p> : null}</div>
      </div>
      {template.rejectionReason ? <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Meta feedback: {template.rejectionReason}</p> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div><label>Meta template name</label><input value={template.metaTemplateName ?? template.name} onChange={(e) => setTemplate({ ...template, metaTemplateName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></div>
        <div><label>Language</label><input value={template.language} onChange={(e) => setTemplate({ ...template, language: e.target.value })} /></div>
        <div><label>Category</label><select value={template.category} onChange={(e) => setTemplate({ ...template, category: e.target.value as Template["category"] })}><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option><option value="AUTHENTICATION">Authentication</option></select></div>
        <div className="md:col-span-3"><label>Header text (optional)</label><input maxLength={60} value={template.headerText ?? ""} onChange={(e) => setTemplate({ ...template, headerText: e.target.value })} /></div>
        <div className="md:col-span-3"><label>Message body</label><textarea rows={7} value={template.bodyText} onChange={(e) => updateBody(e.target.value)} /><p className="mt-2 text-xs text-muted">Use named variables such as {"{{business_name}}"}. They are converted to Meta’s numbered format during submission.</p></div>
        {variables.map((name, index) => <div key={name}><label>Sample for {`{{${name}}}`}</label><input required value={template.sampleValues[index] ?? ""} onChange={(e) => { const values = [...template.sampleValues]; values[index] = e.target.value; setTemplate({ ...template, sampleValues: values }); }} /></div>)}
        <div className="md:col-span-3"><label>Footer text (optional)</label><input maxLength={60} value={template.footerText ?? ""} onChange={(e) => setTemplate({ ...template, footerText: e.target.value })} /></div>
        <div><label>Button</label><select value={template.buttonType} onChange={(e) => setTemplate({ ...template, buttonType: e.target.value as Template["buttonType"] })}><option value="NONE">No button</option><option value="QUICK_REPLY">Quick reply</option><option value="URL">Website URL</option><option value="PHONE_NUMBER">Phone number</option></select></div>
        {template.buttonType !== "NONE" ? <div><label>Button label</label><input maxLength={25} value={template.buttonText ?? ""} onChange={(e) => setTemplate({ ...template, buttonText: e.target.value })} /></div> : null}
        {template.buttonType === "URL" || template.buttonType === "PHONE_NUMBER" ? <div><label>{template.buttonType === "URL" ? "Button URL" : "Phone number"}</label><input value={template.buttonValue ?? ""} onChange={(e) => setTemplate({ ...template, buttonValue: e.target.value })} /></div> : null}
        <div className="md:col-span-3"><label>Internal notes</label><textarea rows={2} value={template.notes ?? ""} onChange={(e) => setTemplate({ ...template, notes: e.target.value })} /></div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className="btn-ghost" disabled={busy} onClick={save}>Save draft</button><button type="button" className="btn-gold" disabled={busy} onClick={publish}>{busy ? "Working…" : template.metaTemplateId ? "Submit update to Meta" : "Submit to Meta"}</button></div>
    </article>
  );
}

function extractVariables(text: string) {
  return Array.from(text.matchAll(/{{\s*([a-z][a-z0-9_]*)\s*}}/gi)).map((match) => match[1].toLowerCase()).filter((name, index, all) => all.indexOf(name) === index);
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "APPROVED" ? "text-ok" : status === "REJECTED" ? "text-danger" : status === "SUBMITTED" ? "text-gold" : "text-muted";
  return <span className={`rounded-full border border-line px-3 py-1 text-xs uppercase tracking-widest ${color}`}>{status}</span>;
}
