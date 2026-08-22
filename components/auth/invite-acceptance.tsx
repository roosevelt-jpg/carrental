"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteAcceptance({ token }: { token: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="mt-6 space-y-4" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const response = await fetch("/api/admin/auth/accept-invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: form.get("name"), password: form.get("password") }) }); const body = await response.json(); setBusy(false); if (!response.ok) return setError(body.error ?? "Invitation could not be accepted"); router.push("/admin/dashboard"); router.refresh(); }}><div><label htmlFor="invite-name">Name</label><input id="invite-name" name="name" autoComplete="name" /></div><div><label htmlFor="invite-password">Password</label><input id="invite-password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div>{error ? <p className="text-sm text-danger">{error}</p> : null}<button className="btn-gold" disabled={busy}>{busy ? "Creating account…" : "Accept invitation"}</button></form>;
}
