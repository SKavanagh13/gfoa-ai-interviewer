export const DEFAULT_ADMIN_AUTH_REDIRECT = "/admin";
export const PASSWORD_RECOVERY_CONFIRM = "/admin/recover";
export const PASSWORD_RECOVERY_REDIRECT = "/admin/update-password";

export function safeAdminAuthRedirect(
  requestedPath: string | null,
  fallback = DEFAULT_ADMIN_AUTH_REDIRECT,
) {
  if (!requestedPath) {
    return fallback;
  }

  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return fallback;
  }

  return requestedPath;
}

export function defaultRedirectForAuthType(type: string | null) {
  return type === "recovery"
    ? PASSWORD_RECOVERY_REDIRECT
    : DEFAULT_ADMIN_AUTH_REDIRECT;
}

export function defaultEmailLinkLandingForAuthType(type: string | null) {
  return type === "recovery" ? PASSWORD_RECOVERY_CONFIRM : "/auth/confirm";
}
