import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/integrations/stripe-client";

export async function processExpireQuotes() {
  const expired = await prisma.quote.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    select: { id: true, checkoutSessionId: true, availabilityBlockId: true },
    take: 100,
  });

  let released = 0;
  for (const quote of expired) {
    if (quote.checkoutSessionId) {
      const stripe = await getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(quote.checkoutSessionId);
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(quote.checkoutSessionId);
      }
      if (session.payment_status === "paid") {
        continue;
      }
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.quote.findUnique({ where: { id: quote.id } });
      if (!current || current.status !== "PENDING" || current.expiresAt > new Date()) return;
      await tx.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
      if (current.availabilityBlockId) {
        await tx.availabilityBlock.deleteMany({
          where: { id: current.availabilityBlockId, reason: "HOLD" },
        });
      }
      released += 1;
    });
  }

  return { scanned: expired.length, released };
}
