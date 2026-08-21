/**
 * Lightweight pre-orchestrator hint for obvious escalation intents.
 * Final decisions still belong to Claude + escalate_to_owner / tools.
 */
export function matchEscalationHint(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(refund|deposit back|money back)\b/.test(lower)) return "refund_request";
  if (
    /\b(speak to (someone|a human|a person)|talk to (someone|a human)|real person)\b/.test(
      lower,
    )
  ) {
    return "explicit_human_request";
  }
  if (/\b(discount|% off|cheaper|negotiate|best price)\b/.test(lower)) {
    return "price_negotiation";
  }
  if (/\b(charged|fee dispute|overcharged|extra fee)\b/.test(lower)) return "fee_dispute";
  if (/\b(under ?2[135]|too young|unsupported licen[cs]e|licen[cs]e not accepted)\b/.test(lower)) {
    return "eligibility_exception";
  }
  if (/\b(you (still )?do not understand|you don't understand|that's not what i (asked|meant))\b/.test(lower)) {
    return "repeated_misunderstanding";
  }
  if (/\b(visa|passport renewal|immigration)\b/.test(lower)) return "out_of_scope";
  return null;
}
