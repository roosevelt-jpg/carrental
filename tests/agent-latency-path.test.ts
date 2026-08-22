import { describe, expect, it, vi } from "vitest";
import { isSimpleGreeting } from "@/lib/queue/jobs/process-inbound-message";
import { remainingTypingDelayMs } from "@/lib/agent/pacing";

describe("fast response path", () => {
  it.each(["Hi", "hello!", "Hey there", "good morning", "Greetings."])(
    "recognizes a simple greeting: %s",
    (value) => expect(isSimpleGreeting(value)).toBe(true),
  );

  it.each(["hi, what cars are available?", "hello I need a quote", "good morning, price please"])(
    "does not bypass tools for a factual request: %s",
    (value) => expect(isSimpleGreeting(value)).toBe(false),
  );

  it("does not add typing delay after generation already took long enough", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:05Z"));
    expect(remainingTypingDelayMs("A concise generated reply.", Date.now() - 5_000)).toBe(0);
    vi.useRealTimers();
  });
});
