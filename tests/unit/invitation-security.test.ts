import { describe, expect, it } from "vitest";
import { createInvitationToken, hashInvitationToken } from "@/lib/auth/invitations";

describe("staff invitation security", () => {
  it("creates one-way, high-entropy invitation tokens", () => {
    const first = createInvitationToken(); const second = createInvitationToken();
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThanOrEqual(40);
    expect(first.tokenHash).toBe(hashInvitationToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
  });
});
