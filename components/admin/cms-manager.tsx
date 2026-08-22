"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Settings = Record<string, string | boolean | null | number> & {
  revision: number;
  sitePublished: boolean;
};
type Faq = { id: string; question: string; answer: string; category: string; sortOrder: number; active: boolean };
type Knowledge = { id: string; title: string; body: string; category: string; keywords: string[]; active: boolean };
type Revision = { revision: number; actorEmail: string | null; createdAt: string };
type Tab = "business" | "website" | "agent" | "faqs" | "knowledge";

const EDITABLE_KEYS = [
  "businessName", "legalName", "tagline", "businessDescription", "phone", "email",
  "whatsappDisplay", "address", "city", "country", "timezone", "currency", "logoUrl",
  "heroImageUrl", "primaryColor", "accentColor", "backgroundColor", "seoTitle",
  "seoDescription", "heroEyebrow", "heroTitle", "heroSubtitle", "heroPrimaryLabel",
  "heroPrimaryHref", "heroSecondaryLabel", "heroSecondaryHref", "aboutTitle", "aboutBody",
  "fleetTitle", "fleetBody", "faqTitle", "contactTitle", "contactBody", "footerText",
  "agentTone", "salesScript", "agentGreeting", "agentHandoffMessage", "prohibitedClaims",
  "quoteHoldMinutes", "dataRetentionDays",
  "sitePublished",
] as const;

const BUSINESS_FIELDS = [
  ["businessName", "Business name"], ["legalName", "Legal name"], ["tagline", "Tagline"],
  ["businessDescription", "Business description", "textarea"], ["phone", "Phone"],
  ["email", "Email"], ["whatsappDisplay", "WhatsApp display number"], ["address", "Address"],
  ["city", "City"], ["country", "Country"], ["timezone", "Timezone"], ["currency", "Currency"],
  ["quoteHoldMinutes", "Quote hold (minutes)"], ["dataRetentionDays", "Customer data retention (days)"],
] as const;
const WEBSITE_FIELDS = [
  ["seoTitle", "SEO title"], ["seoDescription", "SEO description", "textarea"],
  ["heroEyebrow", "Hero eyebrow"], ["heroTitle", "Hero title"],
  ["heroSubtitle", "Hero subtitle", "textarea"], ["heroPrimaryLabel", "Primary button label"],
  ["heroPrimaryHref", "Primary button link"], ["heroSecondaryLabel", "Secondary button label"],
  ["heroSecondaryHref", "Secondary button link"], ["aboutTitle", "About title"],
  ["aboutBody", "About body", "textarea"], ["fleetTitle", "Fleet title"],
  ["fleetBody", "Fleet introduction", "textarea"], ["faqTitle", "FAQ title"],
  ["contactTitle", "Contact title"], ["contactBody", "Contact body", "textarea"],
  ["footerText", "Footer text", "textarea"],
] as const;
const AGENT_FIELDS = [
  ["agentTone", "Tone and voice", "textarea"], ["salesScript", "Sales playbook", "textarea"],
  ["agentGreeting", "Default greeting", "textarea"],
  ["agentHandoffMessage", "Human handoff wording", "textarea"],
  ["prohibitedClaims", "Prohibited claims and promises", "textarea"],
] as const;

export function CmsManager({ settings: initial, faqs, knowledge, revisions }: { settings: Settings; faqs: Faq[]; knowledge: Knowledge[]; revisions: Revision[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("business");
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string | boolean | null) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(publish = false) {
    setBusy(true); setError(null); setMessage(null);
    const payload = Object.fromEntries(
      EDITABLE_KEYS.filter((key) => key !== "sitePublished").map((key) => [key, settings[key]]),
    );
    if (publish) payload.sitePublished = true;
    const response = await fetch("/api/admin/cms/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Could not save content"); return; }
    setSettings((current) => ({ ...current, ...body.settings }));
    setMessage(publish ? "Content saved and public site published." : "Draft content saved without changing the live site.");
    router.refresh();
  }

  async function uploadAsset(field: "logoUrl" | "heroImageUrl", file: File) {
    setBusy(true); setError(null);
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/admin/cms/media", { method: "POST", body: form });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error ?? "Upload failed"); return; }
    setField(field, body.url);
    setMessage("Image uploaded. Save the content to publish the new URL.");
  }

  async function unpublishSite() {
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch("/api/admin/cms/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sitePublished: false }),
    });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error ?? "Could not unpublish the site");
    setSettings((current) => ({ ...current, ...body.settings }));
    setMessage("Public site unpublished. Signed-in staff can still preview the draft.");
    router.refresh();
  }

  const tabs: Array<[Tab, string]> = [["business", "Business & brand"], ["website", "Public website"], ["agent", "AI sales agent"], ["faqs", "FAQs"], ["knowledge", "Knowledge"]];
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-line pb-4">
        {tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={tab === value ? "btn-gold" : "btn-ghost"}>{label}</button>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4 text-sm">
        <div><span className={settings.sitePublished ? "text-ok" : "text-gold"}>{settings.sitePublished ? "Published" : "Draft"}</span><span className="ml-3 text-muted">Revision {settings.revision}</span></div>
        <div className="flex flex-wrap gap-2"><a className="btn-ghost" href="/" target="_blank" rel="noreferrer">Preview draft</a>{settings.sitePublished ? <button className="btn-ghost text-danger" disabled={busy} type="button" onClick={unpublishSite}>Unpublish</button> : null}<button className="btn-ghost" disabled={busy} type="button" onClick={() => saveSettings()}>Save draft</button><button className="btn-gold" disabled={busy} type="button" onClick={() => saveSettings(true)}>Publish</button></div>
      </div>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-ok">{message}</p> : null}

      {tab === "business" ? <section className="mt-6 space-y-6"><FieldGrid fields={BUSINESS_FIELDS} settings={settings} setField={setField} /><div className="grid gap-5 rounded-xl border border-line bg-panel p-6 md:grid-cols-2"><AssetField label="Logo" value={String(settings.logoUrl ?? "")} disabled={busy} onFile={(file) => uploadAsset("logoUrl", file)} /><AssetField label="Hero image" value={String(settings.heroImageUrl ?? "")} disabled={busy} onFile={(file) => uploadAsset("heroImageUrl", file)} /><ColorField label="Primary color" field="primaryColor" settings={settings} setField={setField} /><ColorField label="Accent color" field="accentColor" settings={settings} setField={setField} /><ColorField label="Background color" field="backgroundColor" settings={settings} setField={setField} /></div></section> : null}
      {tab === "website" ? <section className="mt-6"><FieldGrid fields={WEBSITE_FIELDS} settings={settings} setField={setField} /></section> : null}
      {tab === "agent" ? <section className="mt-6"><p className="mb-5 rounded-xl border border-line bg-panel p-4 text-sm text-muted">These fields are injected into every Claude conversation together with live policies and verified knowledge. Hard payment and safety constraints remain enforced in code.</p><FieldGrid fields={AGENT_FIELDS} settings={settings} setField={setField} /></section> : null}
      {tab === "faqs" ? <FaqManager rows={faqs} onError={setError} /> : null}
      {tab === "knowledge" ? <KnowledgeManager rows={knowledge} onError={setError} /> : null}
      {revisions.length > 0 && tab !== "faqs" && tab !== "knowledge" ? <div className="mt-8 rounded-xl border border-line bg-panel p-5"><p className="text-xs uppercase tracking-widest text-muted">Recent revisions</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">{revisions.map((item) => <span key={item.revision}>#{item.revision} · {item.actorEmail ?? "system"} · {new Date(item.createdAt).toLocaleString()}</span>)}</div></div> : null}
    </div>
  );
}

function FieldGrid({ fields, settings, setField }: { fields: readonly (readonly [string, string, string?])[]; settings: Settings; setField: (key: string, value: string) => void }) {
  return <div className="grid gap-5 rounded-xl border border-line bg-panel p-6 md:grid-cols-2">{fields.map(([key, label, kind]) => <div key={key} className={kind === "textarea" ? "md:col-span-2" : ""}><label htmlFor={`cms-${key}`}>{label}</label>{kind === "textarea" ? <textarea id={`cms-${key}`} rows={key === "salesScript" ? 9 : 4} value={String(settings[key] ?? "")} onChange={(event) => setField(key, event.target.value)} /> : <input id={`cms-${key}`} value={String(settings[key] ?? "")} onChange={(event) => setField(key, event.target.value)} />}</div>)}</div>;
}

function AssetField({ label, value, disabled, onFile }: { label: string; value: string; disabled: boolean; onFile: (file: File) => void }) {
  return <div><label>{label}</label><div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-line bg-panel-2/55">{value ? <Image unoptimized fill sizes="(min-width: 768px) 50vw, 100vw" src={value} alt={`Current ${label.toLowerCase()}`} className="object-cover" /> : <div className="grid h-full place-items-center text-sm text-muted">No {label.toLowerCase()} uploaded</div>}</div><input className="mt-3" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /><p className="mt-2 text-xs text-muted">Uploads directly to the configured object storage. No URL entry is required.</p></div>;
}

function ColorField({ label, field, settings, setField }: { label: string; field: string; settings: Settings; setField: (key: string, value: string) => void }) {
  return <div><label htmlFor={`cms-${field}`}>{label}</label><div className="flex gap-3"><input id={`cms-${field}`} type="color" className="h-12 w-20 p-1" value={String(settings[field])} onChange={(event) => setField(field, event.target.value)} /><input value={String(settings[field])} onChange={(event) => setField(field, event.target.value)} /></div></div>;
}

function FaqManager({ rows, onError }: { rows: Faq[]; onError: (value: string | null) => void }) {
  const router = useRouter(); const [question, setQuestion] = useState(""); const [answer, setAnswer] = useState(""); const [category, setCategory] = useState("General"); const [busy, setBusy] = useState(false);
  async function create(event: FormEvent) { event.preventDefault(); setBusy(true); onError(null); const response = await fetch("/api/admin/cms/faqs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, category, sortOrder: rows.length }) }); const body = await response.json(); setBusy(false); if (!response.ok) return onError(body.error ?? "Could not create FAQ"); setQuestion(""); setAnswer(""); router.refresh(); }
  return <section className="mt-6 space-y-4"><form onSubmit={create} className="grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2"><div><label>Question</label><input required value={question} onChange={(e) => setQuestion(e.target.value)} /></div><div><label>Category</label><input required value={category} onChange={(e) => setCategory(e.target.value)} /></div><div className="md:col-span-2"><label>Answer</label><textarea required rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} /></div><button className="btn-gold md:col-span-2 md:w-fit" disabled={busy}>Add FAQ</button></form>{rows.map((row) => <FaqRow key={row.id} row={row} onError={onError} />)}</section>;
}

function FaqRow({ row, onError }: { row: Faq; onError: (value: string | null) => void }) {
  const router = useRouter(); const [value, setValue] = useState(row);
  async function mutate(method: "PATCH" | "DELETE") { const response = await fetch(`/api/admin/cms/faqs/${row.id}`, { method, headers: { "Content-Type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify(value) } : {}) }); const body = await response.json(); if (!response.ok) return onError(body.error ?? "FAQ update failed"); router.refresh(); }
  return <article className="grid gap-4 rounded-xl border border-line bg-panel p-5 md:grid-cols-2"><div><label>Question</label><input value={value.question} onChange={(e) => setValue({ ...value, question: e.target.value })} /></div><div><label>Category</label><input value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })} /></div><div className="md:col-span-2"><label>Answer</label><textarea rows={4} value={value.answer} onChange={(e) => setValue({ ...value, answer: e.target.value })} /></div><label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={value.active} onChange={(e) => setValue({ ...value, active: e.target.checked })} /> Visible and available to AI</label><div className="flex justify-end gap-3"><button className="text-danger" type="button" onClick={() => mutate("DELETE")}>Delete</button><button className="btn-ghost" type="button" onClick={() => mutate("PATCH")}>Save</button></div></article>;
}

function KnowledgeManager({ rows, onError }: { rows: Knowledge[]; onError: (value: string | null) => void }) {
  const router = useRouter(); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [category, setCategory] = useState("General"); const [keywords, setKeywords] = useState("");
  async function create(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/admin/cms/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, category, keywords: splitKeywords(keywords) }) }); const result = await response.json(); if (!response.ok) return onError(result.error ?? "Could not create knowledge entry"); setTitle(""); setBody(""); setKeywords(""); router.refresh(); }
  return <section className="mt-6 space-y-4"><form onSubmit={create} className="grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2"><div><label>Title</label><input required value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><label>Category</label><input required value={category} onChange={(e) => setCategory(e.target.value)} /></div><div className="md:col-span-2"><label>Keywords (comma separated)</label><input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div><div className="md:col-span-2"><label>Verified answer or business knowledge</label><textarea required rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></div><button className="btn-gold md:col-span-2 md:w-fit">Add knowledge</button></form>{rows.map((row) => <KnowledgeRow key={row.id} row={row} onError={onError} />)}</section>;
}

function KnowledgeRow({ row, onError }: { row: Knowledge; onError: (value: string | null) => void }) {
  const router = useRouter(); const [value, setValue] = useState({ ...row, keywordText: row.keywords.join(", ") });
  async function mutate(method: "PATCH" | "DELETE") { const response = await fetch(`/api/admin/cms/knowledge/${row.id}`, { method, headers: { "Content-Type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify({ title: value.title, body: value.body, category: value.category, keywords: splitKeywords(value.keywordText), active: value.active }) } : {}) }); const body = await response.json(); if (!response.ok) return onError(body.error ?? "Knowledge update failed"); router.refresh(); }
  return <article className="grid gap-4 rounded-xl border border-line bg-panel p-5 md:grid-cols-2"><div><label>Title</label><input value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /></div><div><label>Category</label><input value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })} /></div><div className="md:col-span-2"><label>Keywords</label><input value={value.keywordText} onChange={(e) => setValue({ ...value, keywordText: e.target.value })} /></div><div className="md:col-span-2"><label>Verified content</label><textarea rows={7} value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} /></div><label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={value.active} onChange={(e) => setValue({ ...value, active: e.target.checked })} /> Available to AI</label><div className="flex justify-end gap-3"><button className="text-danger" type="button" onClick={() => mutate("DELETE")}>Delete</button><button className="btn-ghost" type="button" onClick={() => mutate("PATCH")}>Save</button></div></article>;
}

function splitKeywords(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
