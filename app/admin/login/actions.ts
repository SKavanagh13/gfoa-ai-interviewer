"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";

export type AdminLoginState = {
  error: string | null;
};

export const initialAdminLoginState: AdminLoginState = {
  error: null,
};

export async function signInAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Sign-in failed. Check your credentials and role." };
  }

  redirect("/admin");
}
