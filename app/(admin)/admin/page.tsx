import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const setup = await getSetupStatus();
  if (!setup.hasUsers || !setup.complete) {
    redirect("/admin/setup");
  }
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }
  redirect("/admin/dashboard");
}
