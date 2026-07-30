import { describe, expect, it } from "vitest";
import { validateServerEnv } from "@/lib/env";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: "5000",
};

describe("validateServerEnv", () => {
  it("returns validated server env values", () => {
    expect(validateServerEnv(validEnv)).toEqual(validEnv);
  });

  it("reports missing required values", () => {
    expect(() =>
      validateServerEnv({
        ...validEnv,
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("requires a positive integer transcript reconciliation timeout", () => {
    expect(() =>
      validateServerEnv({
        ...validEnv,
        TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: "0",
      }),
    ).toThrow("positive integer");
  });
});
