import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCredential } from "@/lib/settings/settings-service";
import { getStripeClient } from "@/lib/integrations/stripe-client";
import { createBooking } from "@/lib/agent/tools/create-booking";
import {
  sendCustomerText,
  sendOwnerOperationalMessage,
} from "@/lib/integrations/whatsapp-messaging";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { escalateToOwner } from "@/lib/agent/tools/escalate-to-owner";
import { captureException } from "@/lib/observability/sentry";
import { getCmsSettings, prepareNotification } from "@/lib/cms/content";

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

  try {
    await prisma.processedWebhookEvent.create({
      data: { provider: "stripe", eventId: event.id },
    });
  } catch (error) {
    captureException(error, { webhook: "stripe", eventId: event.id });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const quoteId = session.metadata?.quoteId ?? session.client_reference_id;
      if (!quoteId || session.amount_total == null || !session.currency) {
        throw new Error("Paid Checkout Session is missing quote metadata or amount");
      }
      const result = await createBooking({
        quote_id: quoteId,
        payment_reference:
          typeof session.payment_intent === "string" ? session.payment_intent : session.id,
        checkout_session_id: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
      });
      if (!result.ok) {
        const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
        if (quote) {
          await escalateToOwner(quote.conversationId, {
            reason_code: "payment_fulfillment_exception",
            conversation_summary: `Stripe reports a paid Checkout Session (${session.id}), but booking fulfillment stopped safely: ${result.error}`,
            urgency: "high",
          });
        }
      } else {
        await notifyBookingConfirmed(quoteId, result);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const quoteId = session.metadata?.quoteId ?? session.client_reference_id;
      if (quoteId) {
        const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
        if (quote?.status === "PENDING") {
          await prisma.$transaction([
            prisma.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } }),
            prisma.availabilityBlock.deleteMany({
              where: { id: quote.availabilityBlockId ?? undefined, reason: "HOLD" },
            }),
          ]);
        }
      }
    }

    await prisma.processedWebhookEvent.update({
      where: { provider_eventId: { provider: "stripe", eventId: event.id } },
      data: { status: "COMPLETE", processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    await prisma.processedWebhookEvent.deleteMany({
      where: { provider: "stripe", eventId: event.id, status: "PROCESSING" },
    });
    console.error(JSON.stringify({
      msg: "stripe_webhook_failed",
      eventId: event.id,
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
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
      booking: true,
    },
  });
  if (!quote) return;
  if (!quote.booking) return;

  const vehicleName = result.vehicle ?? `${quote.vehicle.make} ${quote.vehicle.model}`;
  const cms = await getCmsSettings();
  const bookingNotification = await prepareNotification({
    purpose: "BOOKING_CONFIRMATION",
    values: {
      business_name: cms.businessName,
      vehicle: vehicleName,
      start_date: result.start_date ?? quote.startDate.toISOString().slice(0, 10),
      end_date: result.end_date ?? quote.endDate.toISOString().slice(0, 10),
      booking_id: result.booking_id ?? quote.booking.id,
    },
    fallback: `Booking confirmed for ${vehicleName}. Reference: ${result.booking_id ?? quote.booking.id}. Thank you.`,
  });
  const customerMsg = bookingNotification.text;
  if (!quote.booking.customerNotifiedAt) {
    const sent = await sendCustomerText({
      to: quote.conversation.customer.whatsappId,
      text: customerMsg,
      templatePurpose: "BOOKING_CONFIRMATION",
      templateParameters: bookingNotification.parameters,
    });
    const metaId = (sent as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: quote.conversationId,
          direction: "OUT",
          type: "booking_confirmation",
          content: customerMsg,
          metaMessageId: metaId,
          deliveryStatus: "ACCEPTED",
        },
      }),
      prisma.booking.update({
        where: { id: quote.booking.id },
        data: { customerNotifiedAt: new Date() },
      }),
    ]);
  }

  if (!quote.booking.ownerNotifiedAt) {
    await sendOwnerOperationalMessage({
      purpose: "OWNER_BOOKING",
      text: `New booking ${result.booking_id}: ${customerMsg}`,
    });
    await prisma.booking.update({
      where: { id: quote.booking.id },
      data: { ownerNotifiedAt: new Date() },
    });
  }
}
