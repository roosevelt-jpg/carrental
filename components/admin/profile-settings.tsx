"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { UserRole } from "@prisma/client";

type Profile = { email: string; name: string | null; avatarUrl: string | null; role: UserRole };

export function ProfileSettings({ initialProfile, businessLogoUrl }: { initialProfile: Profile; businessLogoUrl: string | null }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.name ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event?: FormEvent) {
    event?.preventDefault();
    await updateProfile({ name: name.trim() || null, avatarUrl: profile.avatarUrl });
  }

  async function updateProfile(next: { name: string | null; avatarUrl: string | null }) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const body = await response.json() as Profile & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update profile");
      setProfile(body); setName(body.name ?? ""); setMessage("Profile saved"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update profile"); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    setBusy(true); setMessage("");
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch("/api/admin/profile/avatar", { method: "POST", body: form });
      const body = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !body.avatarUrl) throw new Error(body.error || "Could not upload image");
      setProfile((current) => ({ ...current, avatarUrl: body.avatarUrl! })); setMessage("Profile picture updated"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload image"); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  const image = profile.avatarUrl || businessLogoUrl;
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="admin-card rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Identity</p>
        <div className="mt-8 flex flex-col items-center text-center">
          {image ? <Image unoptimized src={image} alt="Current profile" width={128} height={128} className="h-32 w-32 rounded-full border border-gold/30 bg-panel-2 object-cover p-1 shadow-2xl" /> : <span className="grid h-32 w-32 place-items-center rounded-full bg-gold/15 font-serif text-4xl text-gold-2 ring-1 ring-gold/30">{(name || profile.email).charAt(0).toUpperCase()}</span>}
          <p className="mt-5 font-serif text-2xl">{name || "Account profile"}</p>
          <p className="mt-1 text-sm text-muted" data-no-translate>{profile.email}</p>
          <span className="mt-3 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-2">{profile.role}</span>
        </div>
      </section>
      <form onSubmit={save} className="admin-card rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Profile settings</p>
        <h2 className="mt-3 font-serif text-3xl">Your executive profile</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">This identity appears in the admin header. Your public business logo remains managed in Content studio.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="profile-name">Display name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Your name" /></div>
          <div><label htmlFor="profile-email">Email</label><input id="profile-email" value={profile.email} readOnly disabled data-no-translate /></div>
        </div>
        <div className="mt-6 rounded-2xl border border-line bg-panel-2/60 p-5">
          <p className="text-sm font-medium">Profile picture</p>
          <p className="mt-1 text-xs leading-5 text-muted">JPEG, PNG, or WebP. Maximum 5 MB.</p>
          <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="btn-gold">Upload picture</button>
            {businessLogoUrl ? <button type="button" disabled={busy} onClick={() => void updateProfile({ name: name.trim() || null, avatarUrl: businessLogoUrl })} className="btn-ghost">Use business logo</button> : null}
            {profile.avatarUrl ? <button type="button" disabled={busy} onClick={() => void updateProfile({ name: name.trim() || null, avatarUrl: null })} className="btn-ghost text-danger">Remove picture</button> : null}
          </div>
        </div>
        <div className="mt-7 flex items-center gap-4"><button disabled={busy} type="submit" className="btn-gold">{busy ? "Saving…" : "Save profile"}</button>{message ? <p className="text-sm text-muted" role="status">{message}</p> : null}</div>
      </form>
    </div>
  );
}
