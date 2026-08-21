import { ProfileSettings } from "@/components/admin/profile-settings";
import { requireCompleteSetup } from "@/lib/auth/assert";
import { getCmsSettings } from "@/lib/cms/content";
import { prisma } from "@/lib/db";

export default async function ProfilePage() {
  const { session } = await requireCompleteSetup();
  const [profile, cms] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { email: true, name: true, avatarUrl: true, role: true } }),
    getCmsSettings(),
  ]);
  return <ProfileSettings initialProfile={profile} businessLogoUrl={cms.logoUrl} />;
}
