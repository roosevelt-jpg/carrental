import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { getSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";
import {
  CLAUDE_MODEL_OPTIONS,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/integrations/constants";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  try {
    const setup = await getSetupStatus();
    const session = await getSession();

    if (setup.complete) {
      redirect("/admin/dashboard");
    }
    if (setup.hasUsers && !session) {
      redirect("/admin/login");
    }

    return (
      <div className="min-h-screen px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-gold">First-run setup</p>
          <h1 className="mt-3 font-serif text-5xl">Bring the agent live</h1>
          <p className="mt-4 text-muted">
            Your keys, your fleet. Nothing is mocked and nothing is pre-filled with
            sample cars.
          </p>
          <SetupWizard
            initial={setup}
            models={[...CLAUDE_MODEL_OPTIONS]}
            defaultModel={DEFAULT_CLAUDE_MODEL}
          />
        </div>
      </div>
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Setup failed — check DATABASE_URL / SESSION_SECRET on Vercel");
  }
}
