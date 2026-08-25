import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_AUTH_REDIRECT,
  PASSWORD_RECOVERY_REDIRECT,
  defaultRedirectForAuthType,
  safeAdminAuthRedirect,
} from "@/lib/admin/auth-redirect";

describe("admin auth email-link redirects", () => {
  it("keeps redirects on app-local paths", () => {
    expect(safeAdminAuthRedirect("/admin/update-password")).toBe(
      "/admin/update-password",
    );
    expect(safeAdminAuthRedirect("/admin")).toBe("/admin");
  });

  it("rejects external or protocol-relative redirects", () => {
    expect(safeAdminAuthRedirect("https://example.com")).toBe(
      DEFAULT_ADMIN_AUTH_REDIRECT,
    );
    expect(safeAdminAuthRedirect("//example.com/admin")).toBe(
      DEFAULT_ADMIN_AUTH_REDIRECT,
    );
  });

  it("routes recovery links to password update by default", () => {
    expect(defaultRedirectForAuthType("recovery")).toBe(
      PASSWORD_RECOVERY_REDIRECT,
    );
    expect(defaultRedirectForAuthType("magiclink")).toBe(
      DEFAULT_ADMIN_AUTH_REDIRECT,
    );
  });
});
