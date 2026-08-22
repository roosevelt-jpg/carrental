import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireSession } from "@/lib/auth/guards";
import { decryptPii } from "@/lib/privacy/pii";

export async function GET(request: NextRequest) {
  const session = await requireSession("STAFF");
  if (!isSession(session)) return session;

  const status = request.nextUrl.searchParams.get("status");
  const cursor = request.nextUrl.searchParams.get("cursor");
  const take = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1), 100);
  const bookings = await prisma.booking.findMany({
    where: status === "PENDING" || status === "CONFIRMED" || status === "CANCELLED"
      ? { status }
      : undefined,
    include: {
      customer: { select: { id: true, name: true, whatsappId: true } },
      quote: { include: { vehicle: true } },
    },
    orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = bookings.length > take;
  const page = hasMore ? bookings.slice(0, take) : bookings;
  return NextResponse.json({
    bookings: page.map((booking) => ({ ...booking, customer: { ...booking.customer, name: decryptPii(booking.customer.name), whatsappId: decryptPii(booking.customer.whatsappId) } })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
}
