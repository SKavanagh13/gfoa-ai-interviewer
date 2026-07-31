import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/client-env";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createServiceRoleSupabaseClient() {
  const clientEnv = getClientEnv();
  const serverEnv = getServerEnv();

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
