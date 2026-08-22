import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  try {
    const setup = await getSetupStatus();
    if (!setup.hasUsers) {
      redirect("/admin/setup");
    }
    const session = await getSession();
    if (!session) {
      redirect("/admin/login");
    }
    if (!setup.coreComplete) {
      redirect("/admin/setup");
    }
    redirect("/admin/dashboard");
  } catch (error) {
    // redirect() throws NEXT_REDIRECT — must not be treated as a failure.
    if (isRedirectError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Atelier</p>
        <h1 className="mt-3 font-serif text-4xl text-cream">Admin can’t start</h1>
        <p className="mt-4 text-muted">
          The app is deployed, but Postgres or session secrets are failing. Check{" "}
          <a className="text-gold underline" href="/api/health">
            /api/health
          </a>{" "}
          and fix Production env vars on the Vercel <strong>drivn</strong> project.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel p-4 text-xs text-danger">
          {message}
        </pre>
        <ol className="mt-8 list-decimal space-y-2 pl-5 text-sm text-cream/80">
          <li>
            Set a real hosted <code>DATABASE_URL</code> (Neon/Supabase) with{" "}
            <code>?sslmode=require</code> — not localhost.
          </li>
          <li>
            Set a real hosted <code>REDIS_URL</code> (Upstash) — usually{" "}
            <code>rediss://...</code>.
          </li>
          <li>
            Run <code>npx prisma migrate deploy</code> against that database.
          </li>
          <li>Redeploy Production on Vercel.</li>
        </ol>
      </main>
    );
  }
}
