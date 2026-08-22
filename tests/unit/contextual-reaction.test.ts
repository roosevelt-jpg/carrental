import { describe, expect, it } from "vitest";
import { selectContextualReaction } from "@/lib/agent/contextual-reaction";

describe("selectContextualReaction", () => {
  it("uses a neutral processing reaction for a normal enquiry", () => {
    expect(selectContextualReaction({ type: "text", text: "What SUVs are available?" })).toBe("👀");
  });

  it("acknowledges confirmations and completed payments", () => {
    expect(selectContextualReaction({ type: "text", text: "I've paid now" })).toBe("✅");
  });

  it("responds warmly to gratitude in supported languages", () => {
    expect(selectContextualReaction({ type: "text", text: "Thank you for your help" })).toBe("❤️");
    expect(selectContextualReaction({ type: "text", text: "شكرا" })).toBe("❤️");
  });

  it("uses approval for vehicle media and preferences", () => {
    expect(selectContextualReaction({ type: "image" })).toBe("👍");
    expect(selectContextualReaction({ type: "text", text: "I like this one" })).toBe("👍");
  });

  it("does not react to complaints, disputes, or emergencies", () => {
    expect(selectContextualReaction({ type: "text", text: "I want a refund" })).toBeNull();
    expect(selectContextualReaction({ type: "text", text: "There has been an accident" })).toBeNull();
  });

  it("does not react to a customer's reaction", () => {
    expect(selectContextualReaction({ type: "reaction", text: "[Customer reacted 👍]" })).toBeNull();
  });
});
