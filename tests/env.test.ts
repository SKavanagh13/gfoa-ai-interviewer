import { describe, expect, it } from "vitest";
import { validateClientEnv } from "@/lib/client-env";
import { validateServerEnv } from "@/lib/server-env-core";

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const validServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OPENAI_API_KEY: "openai-key",
  OPENAI_REALTIME_MODEL: "gpt-realtime",
  REALTIME_SESSION_TARGET_SECONDS: "900",
  REALTIME_SESSION_HARD_CAP_SECONDS: "1200",
  SIDEBAND_CONNECTION_TIMEOUT_MS: "10000",
  SIDEBAND_DISPATCH_SECRET: "sideband-dispatch-secret",
  PARTICIPANT_SESSION_TOKEN_SECRET: "participant-secret",
  PARTICIPANT_SESSION_TOKEN_TTL_SECONDS: "2700",
  SIDEBAND_WORKER_BASE_URL: "http://localhost:8787",
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

  it("requires the hard cap to be greater than the target duration", () => {
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        REALTIME_SESSION_TARGET_SECONDS: "1200",
        REALTIME_SESSION_HARD_CAP_SECONDS: "900",
      }),
    ).toThrow("greater than");
  });

  it("prevents weakening the 20-minute hard cap", () => {
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        REALTIME_SESSION_HARD_CAP_SECONDS: "1201",
      }),
    ).toThrow("must not exceed 1200");
  });

  it("requires participant session TTL to outlive the hard cap", () => {
    expect(() =>
      validateServerEnv({
        ...validServerEnv,
        PARTICIPANT_SESSION_TOKEN_TTL_SECONDS: "1200",
      }),
    ).toThrow("PARTICIPANT_SESSION_TOKEN_TTL_SECONDS");
  });
});
