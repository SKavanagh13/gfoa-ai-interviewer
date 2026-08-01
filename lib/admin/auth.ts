import "server-only";

import { redirect } from "next/navigation";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";

export type AdminRole = "staff" | "admin";

export type AdminSession = {
  userId: string;
  role: AdminRole;
};

export function parseAdminRole(role: unknown): AdminRole | null {
  return role === "staff" || role === "admin" ? role : null;
}

export async function requireStaffOrAdmin(): Promise<AdminSession> {
  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/admin/login");
  }

  const role = parseAdminRole(data.user.app_metadata.role);
  if (!role) {
    redirect("/admin/login");
  }

  return {
    userId: data.user.id,
    role,
  };
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await requireStaffOrAdmin();

  if (session.role !== "admin") {
    redirect("/admin");
  }

  return session;
}
