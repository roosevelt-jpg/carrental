import Stripe from "stripe";
import { getCredential } from "@/lib/settings/settings-service";

export async function getStripeClient() {
  const secretKey = await getCredential("stripe", "secret_key");
  if (!secretKey) {
    throw new Error("Stripe is not configured");
  }
  return new Stripe(secretKey);
}
