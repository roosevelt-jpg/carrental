import { UsersManager } from "@/components/admin/users-manager";
import { requireCompleteSetup } from "@/lib/auth/assert";
import { prisma } from "@/lib/db";

export default async function UsersPage() {
  const { session } = await requireCompleteSetup();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Users</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Invite staff and assign OWNER / ADMIN / STAFF. Role changes and deletes require OWNER.
      </p>
      <UsersManager
        currentUserId={session.userId}
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
