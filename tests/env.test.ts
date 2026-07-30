import { describe, expect, it } from "vitest";
import { validateClientEnv } from "@/lib/client-env";
import { validateServerEnv } from "@/lib/server-env-core";

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const validServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: "5000",
};

describe("validateClientEnv", () => {
  it("returns validated public client env values", () => {
    expect(validateClientEnv(validClientEnv)).toEqual(validClientEnv);
  });

  it("reports missing public client values", () => {
    expect(() =>
      validateClientEnv({
        ...validClientEnv,
        NEXT_PUBLIC_SUPABASE_URL: "",
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});

describe("validateServerEnv", () => {
  it("returns validated server env values", () => {
    expect(validateServerEnv(validServerEnv)).toEqual(validServerEnv);
  });

  it("reports missing required values", () => {
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("requires a positive integer transcript reconciliation timeout", () => {
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: "0",
      }),
    ).toThrow("positive integer");
  });
});
