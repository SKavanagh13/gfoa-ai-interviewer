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
      ["app", "api", "interview", "[interviewId]", "continue", "route.ts"],
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

  it("authenticates sideband worker dispatches with a shared secret", () => {
    const dispatcher = readWorkspaceFile(
      "lib",
      "interview",
      "sideband-dispatcher.ts",
    );
    const worker = readWorkspaceFile("workers", "sideband-worker.ts");

    expect(dispatcher).toContain("SIDEBAND_DISPATCH_SECRET_HEADER");
    expect(dispatcher).toContain("SIDEBAND_DISPATCH_SECRET");
    expect(worker).toContain("sidebandDispatchSecretMatches");
    expect(worker).toContain("response.writeHead(401)");
  });

  it("treats hard-cap sideband closure as intentional transcript finalization", () => {
    const controller = readWorkspaceFile(
      "lib",
      "interview",
      "sideband-controller.ts",
    );

    expect(controller).toMatch(/intentionalFinalization = true[\s\S]*hangUpRealtimeCall/);
    expect(controller).toContain("sawEndSignal || intentionalFinalization");
  });

  it("does not overwrite prior completed or technical-failure dispositions", () => {
    const repository = readWorkspaceFile(
      "lib",
      "interview",
      "session-repository.ts",
    );

    expect(repository).toContain('.is("end_disposition", null)');
    expect(repository).toContain('.neq("lifecycle_status", "failed")');
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

  it("requires recorded continuation consent before normal browser continuation past target", () => {
    const client = readWorkspaceFile(
      "app",
      "interview",
      "created",
      "live-session-client.tsx",
    );
    const controller = readWorkspaceFile(
      "lib",
      "interview",
      "sideband-controller.ts",
    );

    expect(client).toContain("awaiting_continuation_consent");
    expect(client).toContain("/api/interview/${interviewId}/continue");
    expect(client).toContain("setMicrophoneEnabled(false)");
    expect(client).toContain("setMicrophoneEnabled(true)");
    expect(controller).toContain("hasContinuationConsent");
    expect(controller).toContain("target_without_continuation_consent");
  });
});
