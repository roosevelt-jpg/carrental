import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/integrations/stripe-client";
import { getAppBaseUrl } from "@/lib/env";
import { getExpireQuotesQueue } from "@/lib/queue/queues";

export async function generatePaymentLink(input: {
  quote_id: string;
  amount: number;
}) {
  let quote = await prisma.quote.findUnique({
    where: { id: input.quote_id },
    include: { vehicle: true },
  });
  if (!quote) {
    return { ok: false, error: "Quote not found" };
  }
  if (quote.status !== "PENDING") {
    return { ok: false, error: `Quote is ${quote.status}` };
  }
  if (quote.expiresAt <= new Date()) {
    return { ok: false, error: "Quote has expired" };
  }

  const expected = Number(quote.totalPrice);
  if (Math.abs(expected - input.amount) > 0.01) {
    return {
      ok: false,
      error: "Amount must match the quote total from the database",
      expected,
    };
  }

  const stripe = await getStripeClient();
  const amountCents = Math.round(expected * 100);
  if (quote.checkoutSessionId) {
    const existing = await stripe.checkout.sessions.retrieve(quote.checkoutSessionId);
    if (existing.status === "open" && existing.url) {
      return {
        ok: true,
        quote_id: quote.id,
        payment_link_url: existing.url,
        checkout_session_id: existing.id,
        expires_at: new Date(existing.expires_at * 1000).toISOString(),
        amount: expected,
        currency: "AED",
      };
    }
  }

  const minimumExpiry = new Date(Date.now() + 30 * 60 * 1000);
  if (quote.expiresAt < minimumExpiry) {
    quote = await prisma.quote.update({
      where: { id: quote.id },
      data: { expiresAt: minimumExpiry },
      include: { vehicle: true },
    });
    await getExpireQuotesQueue().add(
      "expire",
      {},
      {
        delay: minimumExpiry.getTime() - Date.now(),
        jobId: `expire-quote-${quote.id}-${minimumExpiry.getTime()}`,
      },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: quote.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aed",
          unit_amount: amountCents,
          product_data: {
            name: `${quote.vehicle.make} ${quote.vehicle.model} rental`,
            metadata: { quoteId: quote.id, vehicleId: quote.vehicleId },
          },
        },
      },
    ],
    metadata: { quoteId: quote.id },
    payment_intent_data: { metadata: { quoteId: quote.id } },
    expires_at: Math.floor(quote.expiresAt.getTime() / 1000),
    success_url: `${getAppBaseUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppBaseUrl()}/payment/cancelled`,
  }, { idempotencyKey: `quote-checkout-${quote.id}-${quote.expiresAt.getTime()}` });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      paymentExpiresAt: new Date(session.expires_at * 1000),
    },
  });

  return {
    ok: true,
    quote_id: quote.id,
    payment_link_url: session.url,
    checkout_session_id: session.id,
    expires_at: new Date(session.expires_at * 1000).toISOString(),
    amount: expected,
    currency: "AED",
  };
}
