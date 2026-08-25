import { NextResponse, type NextRequest } from "next/server";
import { defaultRedirectForAuthType, safeAdminAuthRedirect } from "@/lib/admin/auth-redirect";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const next = safeAdminAuthRedirect(
    requestUrl.searchParams.get("next"),
    defaultRedirectForAuthType(type),
  );

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
