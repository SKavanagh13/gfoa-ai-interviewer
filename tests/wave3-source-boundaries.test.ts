import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Wave 3 route and runtime boundaries", () => {
  it("requires participant-session auth on every participant-facing live route", () => {
    for (const route of [
      ["app", "api", "interview", "[interviewId]", "realtime-call", "route.ts"],
      [
        "app",
        "api",
        "interview",
        "[interviewId]",
        "browser-connected",
        "route.ts",
      ],
      ["app", "api", "interview", "[interviewId]", "end", "route.ts"],
    ]) {
      const source = readWorkspaceFile(...route);

      expect(source).toContain("createAuthorizedParticipantRepository");
      expect(source).toContain("Unauthorized");
    }
  });

  it("keeps the long-lived sideband WebSocket out of Next.js API routes", () => {
    const realtimeCallRoute = readWorkspaceFile(
      "app",
      "api",
      "interview",
      "[interviewId]",
      "realtime-call",
      "route.ts",
    );
    const worker = readWorkspaceFile("workers", "sideband-worker.ts");

    expect(realtimeCallRoute).toContain("dispatchSidebandWorker");
    expect(realtimeCallRoute).not.toContain("runSidebandController");
    expect(worker).toContain("runSidebandController");
  });

  it("uses the mutual activation path from browser and sideband connection flows", () => {
    const repository = readWorkspaceFile(
      "lib",
      "interview",
      "session-repository.ts",
    );

    expect(repository).toMatch(
      /markBrowserConnected[\s\S]*tryMarkInterviewActive/,
    );
    expect(repository).toMatch(
      /markSidebandConnected[\s\S]*tryMarkInterviewActive/,
    );
  });
});
