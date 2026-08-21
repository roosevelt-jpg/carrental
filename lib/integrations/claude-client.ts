import Anthropic from "@anthropic-ai/sdk";
import { getCredential } from "@/lib/settings/settings-service";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/integrations/constants";

export async function getClaudeClient() {
  const apiKey = await getCredential("anthropic", "api_key");
  if (!apiKey) {
    throw new Error("Anthropic is not configured");
  }
  return new Anthropic({ apiKey });
}

export async function getClaudeModelId() {
  return (await getCredential("anthropic", "model_id")) ?? DEFAULT_CLAUDE_MODEL;
}
