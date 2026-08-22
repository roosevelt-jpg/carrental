import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/agent/dates";

export function validatePaidCheckout(input: {
  expectedSessionId: string | null;
  actualSessionId: string;
  expectedAmountMinor: number;
  actualAmountMinor: number;
  currency: string;
  expectedCurrency: string | null;
  paymentStatus: string;
}) {
  if (input.paymentStatus !== "paid") return "Checkout Session is not paid";
  if (input.expectedSessionId !== input.actualSessionId) {
    return "Checkout Session does not belong to this quote";
  }
  if (!input.expectedCurrency || input.currency.toLowerCase() !== input.expectedCurrency.toLowerCase()) {
    return "Unexpected payment currency";
  }
  if (input.actualAmountMinor !== input.expectedAmountMinor) {
    return "Paid amount does not match the quote total";
  }
  return null;
}

export async function createBooking(input: {
  quote_id: string;
  payment_reference: string;
  checkout_session_id: string;
  amount_total: number;
  currency: string;
  payment_status: string;
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
  const expectedMinorUnits = Math.round(Number(quote.totalPrice) * 100);
  const validationError = validatePaidCheckout({
    expectedSessionId: quote.checkoutSessionId,
    actualSessionId: input.checkout_session_id,
    expectedAmountMinor: expectedMinorUnits,
    actualAmountMinor: input.amount_total,
    currency: input.currency,
    expectedCurrency: quote.currency,
    paymentStatus: input.payment_status,
  });
  if (validationError) return { ok: false, error: validationError };
  if (!quote.availabilityBlockId) {
    return { ok: false, error: "Quote no longer has an availability hold" };
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
    const hold = await tx.availabilityBlock.findUnique({
      where: { id: quote.availabilityBlockId! },
    });
    if (!hold || hold.reason !== "HOLD") {
      throw new Error("Availability hold is missing or already consumed");
    }
    await tx.availabilityBlock.update({
      where: { id: hold.id },
      data: { reason: "BOOKED" },
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
  }, { isolationLevel: "Serializable" });

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
