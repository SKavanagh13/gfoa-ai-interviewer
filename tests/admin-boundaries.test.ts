import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readSources(fullPath);
      }
      if (!/\.(ts|tsx)$/u.test(entry.name)) {
        return "";
      }
      return readFileSync(fullPath, "utf8");
    })
    .join("\n");
}

describe("Wave 6 admin source boundaries", () => {
  it("keeps direct participant identifiers behind the named identity path", () => {
    const repository = readFileSync(
      path.join(process.cwd(), "lib", "admin", "repository.ts"),
      "utf8",
    );
    const beforeIdentityMethod = repository.split("async loadParticipantIdentity")[0];

    expect(beforeIdentityMethod).not.toMatch(/\bemail\b/);
    expect(beforeIdentityMethod).not.toMatch(/\bgfoa_member_id\b/);
    expect(beforeIdentityMethod).not.toMatch(/\borganization_name\b/);
  });

  it("does not expose service-role helpers to admin client components", () => {
    const adminAppSource = readSources(path.join(process.cwd(), "app", "admin"));
    const clientFiles = adminAppSource
      .split('"use client";')
      .slice(1)
      .join("\n");

    expect(clientFiles).not.toContain("createServiceRoleSupabaseClient");
    expect(clientFiles).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not add out-of-scope dashboard or aggregate analytics surfaces", () => {
    const adminAppSource = readSources(path.join(process.cwd(), "app", "admin"));

    expect(adminAppSource.toLowerCase()).not.toContain("dashboard");
    expect(adminAppSource.toLowerCase()).not.toContain("aggregate");
    expect(adminAppSource.toLowerCase()).not.toContain("taxonomy");
    expect(adminAppSource.toLowerCase()).not.toContain("recommendation");
  });
});
