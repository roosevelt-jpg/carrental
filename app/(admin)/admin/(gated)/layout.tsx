import type { ReactNode } from "react";
import { AppShell } from "@/components/admin/app-shell";
import { requireCompleteSetup } from "@/lib/auth/assert";

export const dynamic = "force-dynamic";

export default async function GatedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = await requireCompleteSetup();
  return <AppShell session={session}>{children}</AppShell>;
}
