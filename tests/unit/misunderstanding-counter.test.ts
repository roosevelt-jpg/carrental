import { describe, expect, it } from "vitest";
import { nextMisunderstandingCount } from "@/lib/queue/jobs/process-inbound-message";

describe("stateful misunderstanding detection", () => {
  it("counts repeated customer intent across turns and resets on a new intent", () => {
    const text = "I need delivery to the airport";
    expect(nextMisunderstandingCount(text, [], 0)).toBe(0);
    expect(nextMisunderstandingCount(text, [text], 0)).toBe(1);
    expect(nextMisunderstandingCount(text, [text, text], 1)).toBe(2);
    expect(nextMisunderstandingCount("What documents do I need?", [text], 2)).toBe(0);
  });
});
