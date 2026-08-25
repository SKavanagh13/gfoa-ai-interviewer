"use server";

import { redirect } from "next/navigation";
import { requireStaffOrAdmin } from "@/lib/admin/auth";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";
import type { AdminPasswordState } from "@/app/admin/update-password/state";

export async function updateAdminPassword(
  _previousState: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords must match." };
  }

  await requireStaffOrAdmin();

  const supabase = await createAuthenticatedSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Password update failed. Request a fresh recovery link." };
  }

  redirect("/admin");
}
