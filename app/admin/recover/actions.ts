"use server";

import { redirect } from "next/navigation";
import { PASSWORD_RECOVERY_REDIRECT } from "@/lib/admin/auth-redirect";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";
import type { AdminRecoveryState } from "@/app/admin/recover/state";

export async function confirmAdminPasswordRecovery(
  _previousState: AdminRecoveryState,
  formData: FormData,
): Promise<AdminRecoveryState> {
  const tokenHash = String(formData.get("tokenHash") ?? "");
  const next = String(formData.get("next") ?? PASSWORD_RECOVERY_REDIRECT);

  if (!tokenHash) {
    return { error: "This recovery link is missing its verification token." };
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return {
      error: "This recovery link is invalid or has expired. Request a fresh link.",
    };
  }

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : PASSWORD_RECOVERY_REDIRECT);
}
