import { validateServerEnv, type ServerEnv } from "@/lib/server-env-core";

export type { ServerEnv } from "@/lib/server-env-core";
export { validateServerEnv } from "@/lib/server-env-core";

export function getServerRuntimeEnv(): ServerEnv {
  return validateServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
    REALTIME_SESSION_TARGET_SECONDS:
      process.env.REALTIME_SESSION_TARGET_SECONDS,
    REALTIME_SESSION_HARD_CAP_SECONDS:
      process.env.REALTIME_SESSION_HARD_CAP_SECONDS,
    SIDEBAND_CONNECTION_TIMEOUT_MS:
      process.env.SIDEBAND_CONNECTION_TIMEOUT_MS,
    PARTICIPANT_SESSION_TOKEN_SECRET:
      process.env.PARTICIPANT_SESSION_TOKEN_SECRET,
    PARTICIPANT_SESSION_TOKEN_TTL_SECONDS:
      process.env.PARTICIPANT_SESSION_TOKEN_TTL_SECONDS,
    SIDEBAND_WORKER_BASE_URL: process.env.SIDEBAND_WORKER_BASE_URL,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      process.env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  });
}
