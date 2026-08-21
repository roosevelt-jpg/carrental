import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/agent/dates";

export async function createBooking(input: {
  quote_id: string;
  payment_reference: string;
}) {
  const quote = await prisma.quote.findUnique({
    where: { id: input.quote_id },
    include: { booking: true, conversation: true, vehicle: true },
  });
  if (!quote) {
    return { ok: false, error: "Quote not found" };
  }
  if (quote.booking) {
    return {
      ok: true,
      already_existed: true,
      booking_id: quote.booking.id,
      status: quote.booking.status,
    };
  }

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        quoteId: quote.id,
        customerId: quote.conversation.customerId,
        paymentReference: input.payment_reference,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: "CONFIRMED" },
    });
    await tx.availabilityBlock.create({
      data: {
        vehicleId: quote.vehicleId,
        startDate: quote.startDate,
        endDate: quote.endDate,
        reason: "BOOKED",
      },
    });
    await tx.conversationOutcome.upsert({
      where: { conversationId: quote.conversationId },
      create: {
        conversationId: quote.conversationId,
        outcome: "BOOKED",
        taggedBy: "SYSTEM",
      },
      update: { outcome: "BOOKED", taggedBy: "SYSTEM", taggedAt: new Date() },
    });
    return created;
  });

  return {
    ok: true,
    booking_id: booking.id,
    quote_id: quote.id,
    vehicle: `${quote.vehicle.make} ${quote.vehicle.model}`,
    start_date: parseDateOnly(
      quote.startDate.toISOString().slice(0, 10),
    ).toISOString().slice(0, 10),
    end_date: quote.endDate.toISOString().slice(0, 10),
    payment_reference: input.payment_reference,
  };
}
