import { describe, expect, it } from "vitest";
import {
  SIDEBAND_DISPATCH_SECRET_HEADER,
  sidebandDispatchSecretMatches,
} from "@/lib/interview/sideband-dispatch-auth";

describe("sideband dispatch auth", () => {
  it("uses the expected dispatch secret header name", () => {
    expect(SIDEBAND_DISPATCH_SECRET_HEADER).toBe(
      "x-sideband-dispatch-secret",
    );
  });

  it("accepts matching dispatch secrets and rejects missing or mismatched values", () => {
    expect(sidebandDispatchSecretMatches("secret", "secret")).toBe(true);
    expect(sidebandDispatchSecretMatches("secret", undefined)).toBe(false);
    expect(sidebandDispatchSecretMatches("secret", "wrong")).toBe(false);
  });
});
