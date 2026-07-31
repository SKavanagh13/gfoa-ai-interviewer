import "server-only";

import { createServiceRoleSupabaseRuntimeClient } from "@/lib/supabase/service-role";

export function createServiceRoleSupabaseClient() {
  return createServiceRoleSupabaseRuntimeClient();
}
