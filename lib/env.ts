import "server-only";

import { validateServerEnv, type ServerEnv } from "@/lib/server-env-core";

export type { ServerEnv } from "@/lib/server-env-core";
export { validateServerEnv } from "@/lib/server-env-core";

export function getServerEnv(): ServerEnv {
  return validateServerEnv({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      process.env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  });
}
