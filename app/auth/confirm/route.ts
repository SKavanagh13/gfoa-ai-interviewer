import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { defaultRedirectForAuthType, safeAdminAuthRedirect } from "@/lib/admin/auth-redirect";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";

const allowedEmailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeAdminAuthRedirect(
    requestUrl.searchParams.get("next"),
    defaultRedirectForAuthType(type),
  );

  if (!tokenHash || !type || !allowedEmailOtpTypes.has(type)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
