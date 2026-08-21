import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCredential } from "@/lib/settings/settings-service";
import { getStripeClient } from "@/lib/integrations/stripe-client";
import { createBooking } from "@/lib/agent/tools/create-booking";
import { sendTextMessage } from "@/lib/integrations/whatsapp-client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = await getCredential("stripe", "webhook_signing_secret");

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const stripe = await getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "payment_intent.succeeded"
  ) {
    const quoteId = extractQuoteId(event);
    const paymentReference = extractPaymentReference(event);
    if (quoteId && paymentReference) {
      const result = await createBooking({
        quote_id: quoteId,
        payment_reference: paymentReference,
      });
      if (result.ok && !("already_existed" in result && result.already_existed)) {
        await notifyBookingConfirmed(quoteId, result);
      }
    }
  }

  return NextResponse.json({ received: true });
}

function extractQuoteId(event: Stripe.Event): string | null {
  const obj = event.data.object as {
    metadata?: Record<string, string>;
    client_reference_id?: string | null;
  };
  return obj.metadata?.quoteId ?? obj.client_reference_id ?? null;
}

function extractPaymentReference(event: Stripe.Event): string | null {
  const obj = event.data.object as { id?: string };
  return obj.id ?? event.id;
}

async function notifyBookingConfirmed(
  quoteId: string,
  result: { booking_id?: string; vehicle?: string; start_date?: string; end_date?: string },
) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      conversation: { include: { customer: true } },
      vehicle: true,
    },
  });
  if (!quote) return;

  const customerMsg = `Booking confirmed for ${result.vehicle ?? `${quote.vehicle.make} ${quote.vehicle.model}`} (${result.start_date ?? ""} → ${result.end_date ?? ""}). Reference: ${result.booking_id}. Thank you.`;
  await sendTextMessage(quote.conversation.customer.whatsappId, customerMsg);
  await prisma.message.create({
    data: {
      conversationId: quote.conversationId,
      direction: "OUT",
      type: "text",
      content: customerMsg,
    },
  });

  const ownerPhone = await getCredential("whatsapp", "owner_phone_number");
  if (ownerPhone) {
    await sendTextMessage(
      ownerPhone,
      `New booking ${result.booking_id}: ${customerMsg}`,
    );
  }
}
