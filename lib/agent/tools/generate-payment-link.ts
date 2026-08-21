import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/integrations/stripe-client";
import { getAppBaseUrl } from "@/lib/env";

export async function generatePaymentLink(input: {
  quote_id: string;
  amount: number;
}) {
  const quote = await prisma.quote.findUnique({
    where: { id: input.quote_id },
    include: { vehicle: true },
  });
  if (!quote) {
    return { ok: false, error: "Quote not found" };
  }
  if (quote.status !== "PENDING") {
    return { ok: false, error: `Quote is ${quote.status}` };
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
  const product = await stripe.products.create({
    name: `${quote.vehicle.make} ${quote.vehicle.model} rental`,
    metadata: { quoteId: quote.id, vehicleId: quote.vehicleId },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: "aed",
  });
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { quoteId: quote.id },
    after_completion: {
      type: "redirect",
      redirect: { url: `${getAppBaseUrl()}/admin/bookings` },
    },
  });

  return {
    ok: true,
    quote_id: quote.id,
    payment_link_url: link.url,
    payment_link_id: link.id,
    amount: expected,
    currency: "AED",
  };
}
