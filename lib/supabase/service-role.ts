import { createClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/client-env";
import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import type { Database } from "@/types/database.types";

export function createServiceRoleSupabaseRuntimeClient() {
  const clientEnv = getClientEnv();
  const serverEnv = getServerRuntimeEnv();

  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
