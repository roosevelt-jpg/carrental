import Link from "next/link";
import { prisma } from "@/lib/db";
import { decryptPii } from "@/lib/privacy/pii";

export default async function BookingsPage() {
  const bookings = await prisma.booking.findMany({
    include: {
      customer: true,
      quote: { include: { vehicle: true } },
    },
    orderBy: { confirmedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="font-serif text-4xl">Bookings</h1>
      <p className="mt-3 text-muted">
        {bookings.length === 0
          ? "Confirmed bookings from real Stripe payments will list here."
          : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`}
      </p>
      {bookings.length > 0 ? (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr>
              <th className="pb-3">Vehicle</th>
              <th className="pb-3">Customer</th>
              <th className="pb-3">Dates</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-t border-line">
                <td className="py-4">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="text-gold-2 hover:underline"
                  >
                    {booking.quote.vehicle.make} {booking.quote.vehicle.model}
                  </Link>
                </td>
                <td className="py-4">{decryptPii(booking.customer.whatsappId)}</td>
                <td className="py-4">
                  {booking.quote.startDate.toISOString().slice(0, 10)} →{" "}
                  {booking.quote.endDate.toISOString().slice(0, 10)}
                </td>
                <td className="py-4">{booking.status}</td>
                <td className="py-4 font-mono text-xs">
                  {booking.paymentReference ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
