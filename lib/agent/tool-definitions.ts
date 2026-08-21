import type Anthropic from "@anthropic-ai/sdk";

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_fleet_catalog",
    description: "List available vehicles matching category/date/budget filters.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        category: { type: "string" },
        max_daily_budget: { type: "number" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_vehicle_pricing",
    description:
      "Exact price quote for one vehicle over a date range, including applicable pricing rules.",
    input_schema: {
      type: "object",
      properties: {
        vehicle_id: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["vehicle_id", "start_date", "end_date"],
    },
  },
  {
    name: "check_availability",
    description:
      "Confirm a vehicle is free for the requested dates; returns the next available window if not.",
    input_schema: {
      type: "object",
      properties: {
        vehicle_id: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["vehicle_id", "start_date", "end_date"],
    },
  },
  {
    name: "get_vehicle_photos",
    description:
      "Fetch cached WhatsApp media IDs for a vehicle so they can be sent to the customer.",
    input_schema: {
      type: "object",
      properties: { vehicle_id: { type: "string" } },
      required: ["vehicle_id"],
    },
  },
  {
    name: "create_quote",
    description: "Persist a quote against the current conversation.",
    input_schema: {
      type: "object",
      properties: {
        vehicle_id: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        total_price: { type: "number" },
      },
      required: ["vehicle_id", "start_date", "end_date", "total_price"],
    },
  },
  {
    name: "generate_payment_link",
    description: "Create a Stripe Payment Link for a confirmed quote.",
    input_schema: {
      type: "object",
      properties: {
        quote_id: { type: "string" },
        amount: { type: "number" },
      },
      required: ["quote_id", "amount"],
    },
  },
  {
    name: "create_booking",
    description: "Finalize a booking after payment confirmation.",
    input_schema: {
      type: "object",
      properties: {
        quote_id: { type: "string" },
        payment_reference: { type: "string" },
      },
      required: ["quote_id", "payment_reference"],
    },
  },
  {
    name: "get_policy",
    description:
      "Retrieve current policy text (deposit, documentation, delivery, or cancellation).",
    input_schema: {
      type: "object",
      properties: {
        policy_type: {
          type: "string",
          enum: ["deposit", "documentation", "delivery", "cancellation"],
        },
      },
      required: ["policy_type"],
    },
  },
  {
    name: "escalate_to_owner",
    description:
      "Hand off to the human owner with full context. Use whenever a matching escalation rule fires or the agent cannot confidently resolve the customer's request with its available tools.",
    input_schema: {
      type: "object",
      properties: {
        reason_code: { type: "string" },
        conversation_summary: { type: "string" },
        urgency: { type: "string", enum: ["normal", "high"] },
      },
      required: ["reason_code", "conversation_summary"],
    },
  },
];
