import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseAdminRole } from "@/lib/admin/auth";

describe("Wave 6 admin auth roles", () => {
  it("accepts only staff and admin app_metadata roles", () => {
    expect(parseAdminRole("staff")).toBe("staff");
    expect(parseAdminRole("admin")).toBe("admin");
    expect(parseAdminRole("participant")).toBeNull();
    expect(parseAdminRole(undefined)).toBeNull();
  });
});
