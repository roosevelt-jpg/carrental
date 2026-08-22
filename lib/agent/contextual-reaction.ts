const SENSITIVE_MESSAGE =
  /\b(refund|money back|deposit back|complaint|angry|upset|dispute|overcharg(?:e|ed)|fraud|scam|accident|crash|injur(?:y|ed)|police|lawyer|legal|emergency|cancel)\b|استرداد|شكوى|حادث|شرطة|محامي|طوارئ/i;

const GRATITUDE_MESSAGE =
  /\b(thank(?:s| you)?|appreciate it|gracias|merci|danke|obrigad[oa]|grazie|terima kasih|salamat)\b|شكرا|شكرًا/i;

const CONFIRMATION_MESSAGE =
  /\b(book(?:ed|ing confirmed)|confirmed|i confirm|payment (?:is )?(?:done|paid|complete)|i(?:'ve| have) paid|paid now|تم الدفع|تم التأكيد)\b/i;

const VEHICLE_INTEREST_MESSAGE =
  /\b(i like|looks good|love (?:this|that)|this one|that one|interested in|my choice|prefer|favorite|favourite)\b|أعجبني|أفضل هذه/i;

/**
 * Keep acknowledgement reactions predictable. Sensitive messages receive no
 * emoji; unfamiliar languages safely fall back to the neutral processing cue.
 */
export function selectContextualReaction(input: {
  type: string;
  text?: string;
}): string | null {
  if (input.type === "reaction") return null;
  if (input.type === "image" || input.type === "video") return "👍";

  const text = input.text?.trim();
  if (!text) return "👀";
  if (SENSITIVE_MESSAGE.test(text)) return null;
  if (GRATITUDE_MESSAGE.test(text)) return "❤️";
  if (CONFIRMATION_MESSAGE.test(text)) return "✅";
  if (VEHICLE_INTEREST_MESSAGE.test(text)) return "👍";
  return "👀";
}
