import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { decryptPii } from "@/lib/privacy/pii";

type Params = { params: Promise<{ id: string }> };

export default async function BookingDetailPage({ params }: Params) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      quote: { include: { vehicle: true, conversation: true } },
    },
  });
  if (!booking) notFound();

  return (
    <div>
      <Link href="/admin/bookings" className="text-sm text-gold hover:underline">
        ← Bookings
      </Link>
      <h1 className="mt-3 font-serif text-4xl">Booking</h1>
      <p className="mt-2 font-mono text-sm text-muted">{booking.id}</p>

      <dl className="mt-8 grid max-w-2xl gap-4 rounded-xl border border-line bg-panel p-6 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Vehicle</dt>
          <dd className="mt-1">
            {booking.quote.vehicle.make} {booking.quote.vehicle.model}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Customer</dt>
          <dd className="mt-1">{decryptPii(booking.customer.whatsappId)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Dates</dt>
          <dd className="mt-1">
            {booking.quote.startDate.toISOString().slice(0, 10)} →{" "}
            {booking.quote.endDate.toISOString().slice(0, 10)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Total</dt>
          <dd className="mt-1">
            {booking.quote.totalPrice.toString()} {booking.quote.currency ?? "Currency not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Status</dt>
          <dd className="mt-1">{booking.status}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-muted">Payment ref</dt>
          <dd className="mt-1 font-mono text-xs">{booking.paymentReference ?? "—"}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm">
        <Link
          href={`/admin/conversations/${booking.quote.conversationId}`}
          className="text-gold hover:underline"
        >
          Open conversation
        </Link>
      </p>
    </div>
  );
}
