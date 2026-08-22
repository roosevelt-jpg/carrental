import { describe, expect, it } from "vitest";
import { isAllowedInboundMime } from "@/lib/queue/jobs/process-inbound-message";

describe("inbound WhatsApp media safety", () => {
  it("accepts supported image, video, audio, and document formats", () => {
    expect(isAllowedInboundMime("image", "image/jpeg")).toBe(true);
    expect(isAllowedInboundMime("video", "video/mp4")).toBe(true);
    expect(isAllowedInboundMime("audio", "audio/ogg; codecs=opus")).toBe(true);
    expect(isAllowedInboundMime("document", "application/pdf")).toBe(true);
  });

  it("rejects active or mismatched content", () => {
    expect(isAllowedInboundMime("image", "image/svg+xml")).toBe(false);
    expect(isAllowedInboundMime("document", "text/html")).toBe(false);
    expect(isAllowedInboundMime("video", "application/javascript")).toBe(false);
  });
});
