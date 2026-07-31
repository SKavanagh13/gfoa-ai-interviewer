import "server-only";

import { getServerRuntimeEnv, type ServerEnv } from "@/lib/server-runtime-env";

export type { ServerEnv } from "@/lib/server-runtime-env";

export function getServerEnv(): ServerEnv {
  return getServerRuntimeEnv();
}
