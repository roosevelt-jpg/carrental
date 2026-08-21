import type { ReactNode } from "react";
import { AppShell } from "@/components/admin/app-shell";
import { requireCompleteSetup } from "@/lib/auth/assert";
import { prisma } from "@/lib/db";
import { getCmsSettings } from "@/lib/cms/content";

export const dynamic = "force-dynamic";

export default async function GatedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = await requireCompleteSetup();
  const [profile, cms] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { email: true, name: true, avatarUrl: true, role: true } }),
    getCmsSettings(),
  ]);
  return <AppShell profile={profile} businessName={cms.businessName} businessLogoUrl={cms.logoUrl}>{children}</AppShell>;
}
