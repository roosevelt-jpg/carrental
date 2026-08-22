"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    role: "STAFF",
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create user");
      return;
    }
    setForm({ email: "", role: "STAFF" });
    setInviteUrl(body.invitation.inviteUrl);
  }

  async function setRole(id: string, role: string) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not update role");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not delete user");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <form className="grid gap-4 rounded-xl border border-line bg-panel p-6 md:grid-cols-2" onSubmit={invite}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-gold" disabled={busy} type="submit">
            Invite user
          </button>
        </div>
        {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
        {inviteUrl ? <div className="md:col-span-2 rounded-xl border border-gold/20 bg-gold/5 p-4"><p className="text-xs text-gold">Secure invitation created. Share this one-time link with the invited person:</p><div className="mt-2 flex gap-2"><input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="btn-ghost" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy</button></div><p className="mt-2 text-xs text-muted">Expires in 48 hours.</p></div> : null}
      </form>

      <ul className="space-y-3">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4"
          >
            <div>
              <p className="text-gold-2">{user.email}</p>
              <p className="text-xs text-muted">
                {user.role} · since {new Date(user.createdAt).toLocaleDateString()}
                {user.id === currentUserId ? " · you" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={user.role}
                disabled={user.id === currentUserId}
                onChange={(e) => setRole(user.id, e.target.value)}
                className="w-auto"
              >
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
                <option value="OWNER">OWNER</option>
              </select>
              {user.id !== currentUserId ? (
                <button type="button" className="text-sm text-danger" onClick={() => remove(user.id)}>
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
