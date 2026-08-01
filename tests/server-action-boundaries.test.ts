import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverActionFiles = [
  "app/admin/actions.ts",
  "app/admin/login/actions.ts",
  "app/interview/actions.ts",
];

describe("server action module boundaries", () => {
  it("keeps runtime exports in use server files limited to async actions", () => {
    for (const file of serverActionFiles) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");

      expect(source.trimStart().startsWith('"use server";')).toBe(true);
      expect(source).not.toMatch(/export\s+const\s+/);
      expect(source).not.toMatch(/export\s+(?:type|interface)\s+/);

      const exportedFunctions = source.match(/export\s+(?:async\s+)?function\s+/g) ?? [];
      expect(exportedFunctions.every((match) => match.includes("async"))).toBe(
        true,
      );
    }
  });
});
