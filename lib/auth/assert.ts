import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { getSetupStatus, type SetupStatus } from "@/lib/setup/status";

export async function requireCompleteSetup(): Promise<{
  session: SessionPayload;
  setup: SetupStatus;
}> {
  const setup = await getSetupStatus();
  const session = await getSession();
  if (!setup.hasUsers) {
    redirect("/admin/setup");
  }
  if (!session) {
    redirect("/admin/login");
  }
  // Integrations can be completed later via /admin/settings/integrations.
  return { session, setup };
}
