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
      if (!/\.(ts|tsx|sql|md|json)$/u.test(entry.name)) {
        return "";
      }
      return readFileSync(fullPath, "utf8");
    })
    .join("\n");
}

describe("Wave 5 source boundaries", () => {
  it("keeps Wave 6 admin review separate from live interviewer code", () => {
    const adminPage = readFileSync(
      path.join(process.cwd(), "app", "admin", "page.tsx"),
      "utf8",
    );

    expect(adminPage).toContain("Admin Review");
    expect(adminPage).not.toContain("OPENAI_REALTIME_MODEL");
  });

  it("keeps live interviewer and post-interview analysis model calls separate", () => {
    const liveSource = readSources(path.join(process.cwd(), "lib", "interview"));
    const analysisSource = readSources(path.join(process.cwd(), "lib", "analysis"));

    expect(liveSource).toContain("Do not perform post-interview analysis");
    expect(liveSource).not.toContain("OPENAI_ANALYSIS_MODEL");
    expect(analysisSource).not.toContain("OPENAI_REALTIME_MODEL");
  });

  it("does not add direct identifiers to analytical database tables in Wave 5", () => {
    const wave5Migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260731170000_wave_5_post_interview_analysis.sql",
      ),
      "utf8",
    ).toLowerCase();

    expect(wave5Migration).not.toMatch(/\bemail\b/);
    expect(wave5Migration).not.toMatch(/\bgfoa_member_id\b/);
    expect(wave5Migration).not.toMatch(/\borganization_name\b/);
  });
});
