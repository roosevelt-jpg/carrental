import { getFleetCatalog } from "@/lib/agent/tools/get-fleet-catalog";
import { getVehiclePricing } from "@/lib/agent/tools/get-vehicle-pricing";
import { checkAvailability } from "@/lib/agent/tools/check-availability";
import { getVehiclePhotos } from "@/lib/agent/tools/get-vehicle-photos";
import { createQuote } from "@/lib/agent/tools/create-quote";
import { generatePaymentLink } from "@/lib/agent/tools/generate-payment-link";
import { createBooking } from "@/lib/agent/tools/create-booking";
import { getPolicy } from "@/lib/agent/tools/get-policy";
import { escalateToOwner } from "@/lib/agent/tools/escalate-to-owner";

export type ToolContext = {
  conversationId: string;
};

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "get_fleet_catalog":
        return await getFleetCatalog({
          start_date: String(input.start_date),
          end_date: String(input.end_date),
          category: input.category ? String(input.category) : undefined,
          max_daily_budget:
            input.max_daily_budget != null
              ? Number(input.max_daily_budget)
              : undefined,
        });
      case "get_vehicle_pricing":
        return await getVehiclePricing({
          vehicle_id: String(input.vehicle_id),
          start_date: String(input.start_date),
          end_date: String(input.end_date),
        });
      case "check_availability":
        return await checkAvailability({
          vehicle_id: String(input.vehicle_id),
          start_date: String(input.start_date),
          end_date: String(input.end_date),
        });
      case "get_vehicle_photos":
        return await getVehiclePhotos({ vehicle_id: String(input.vehicle_id) });
      case "create_quote":
        return await createQuote(ctx.conversationId, {
          vehicle_id: String(input.vehicle_id),
          start_date: String(input.start_date),
          end_date: String(input.end_date),
          total_price: Number(input.total_price),
        });
      case "generate_payment_link":
        return await generatePaymentLink({
          quote_id: String(input.quote_id),
          amount: Number(input.amount),
        });
      case "create_booking":
        return await createBooking({
          quote_id: String(input.quote_id),
          payment_reference: String(input.payment_reference),
        });
      case "get_policy":
        return await getPolicy({ policy_type: String(input.policy_type) });
      case "escalate_to_owner":
        return await escalateToOwner(ctx.conversationId, {
          reason_code: String(input.reason_code),
          conversation_summary: String(input.conversation_summary),
          urgency: input.urgency ? String(input.urgency) : undefined,
        });
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tool failed",
      escalate_recommended: true,
    };
  }
}
