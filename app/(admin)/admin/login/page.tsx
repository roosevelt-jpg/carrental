import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const setup = await getSetupStatus();
  if (!setup.hasUsers) {
    redirect("/admin/setup");
  }
  const session = await getSession();
  if (session) {
    redirect(setup.complete ? "/admin/dashboard" : "/admin/setup");
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Atelier Fleet</p>
        <h1 className="mt-3 font-serif text-4xl">Sign in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
