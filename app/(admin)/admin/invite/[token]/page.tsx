import { InviteAcceptance } from "@/components/auth/invite-acceptance";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16"><section className="w-full rounded-3xl border border-line bg-panel p-8"><p className="text-xs uppercase tracking-[0.22em] text-gold">Team invitation</p><h1 className="mt-3 font-serif text-4xl">Create your secure account</h1><p className="mt-3 text-sm text-muted">Choose your own password. This invitation can be used once and expires after 48 hours.</p><InviteAcceptance token={token} /></section></main>;
}
