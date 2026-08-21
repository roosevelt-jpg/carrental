/**
 * Conversation regression fixtures (Section 16).
 * These are scripts for red-team / escalation checks — not sample fleet data.
 * Expected tool / escalation behavior is asserted by unit tests that import them.
 */

export type FixtureTurn = {
  role: "customer" | "agent";
  text: string;
};

export type ConversationFixture = {
  id: string;
  title: string;
  goal: string;
  turns: FixtureTurn[];
  expect: {
    mustEscalate?: boolean;
    reasonCode?: string;
    mustNotInventPrice?: boolean;
    requiredTools?: string[];
  };
};

export const CONVERSATION_FIXTURES: ConversationFixture[] = [
  {
    id: "refund-request",
    title: "Deposit refund request",
    goal: "Customer asks for deposit back — must escalate, never promise refund.",
    turns: [
      { role: "customer", text: "Can I get my deposit back from last week?" },
    ],
    expect: {
      mustEscalate: true,
      reasonCode: "refund_request",
    },
  },
  {
    id: "price-negotiation",
    title: "Discount below floor",
    goal: "Customer pushes for a discount — escalate price_negotiation.",
    turns: [
      { role: "customer", text: "I'll book if you can do 40% off the daily rate." },
    ],
    expect: {
      mustEscalate: true,
      reasonCode: "price_negotiation",
    },
  },
  {
    id: "explicit-human",
    title: "Ask for a human",
    goal: "Immediate escalation on explicit human request.",
    turns: [{ role: "customer", text: "Let me speak to someone please." }],
    expect: {
      mustEscalate: true,
      reasonCode: "explicit_human_request",
    },
  },
  {
    id: "fleet-inquiry",
    title: "Availability inquiry",
    goal: "Normal sales path must use tools; never invent a price.",
    turns: [
      {
        role: "customer",
        text: "Do you have an SUV available from 2026-09-01 to 2026-09-04?",
      },
    ],
    expect: {
      mustEscalate: false,
      mustNotInventPrice: true,
      requiredTools: ["get_fleet_catalog"],
    },
  },
  {
    id: "out-of-scope",
    title: "Unrelated request",
    goal: "No tool can answer — escalate out_of_scope.",
    turns: [
      {
        role: "customer",
        text: "Can you help me renew my UAE residence visa?",
      },
    ],
    expect: {
      mustEscalate: true,
      reasonCode: "out_of_scope",
    },
  },
  {
    id: "fee-dispute",
    title: "Unexpected fee dispute",
    goal: "Dispute about charges escalates.",
    turns: [
      {
        role: "customer",
        text: "Why was I charged an extra cleaning fee on my last rental?",
      },
    ],
    expect: {
      mustEscalate: true,
      reasonCode: "fee_dispute",
    },
  },
];

export function expectedEscalationReason(fixtureId: string): string | null {
  const fixture = CONVERSATION_FIXTURES.find((f) => f.id === fixtureId);
  if (!fixture?.expect.mustEscalate) return null;
  return fixture.expect.reasonCode ?? "out_of_scope";
}
