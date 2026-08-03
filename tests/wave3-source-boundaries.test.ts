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

  it("keeps the sideband worker deployable as a long-lived Node service", () => {
    const packageJson = JSON.parse(readWorkspaceFile("package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    const worker = readWorkspaceFile("workers", "sideband-worker.ts");

    expect(packageJson.scripts["sideband:start"]).toBe(
      "tsx workers/sideband-worker.ts",
    );
    expect(packageJson.dependencies).toHaveProperty("tsx");
    expect(worker).toContain("process.env.PORT");
    expect(worker).toMatch(/process\.env\.PORT[\s\S]*SIDEBAND_WORKER_PORT/);
  });

  it("terminates a created Realtime call when sideband dispatch fails", () => {
    const route = readWorkspaceFile(
      "app",
      "api",
      "interview",
      "[interviewId]",
      "realtime-call",
      "route.ts",
    );

    expect(route).toContain("hangUpRealtimeCall");
    expect(route).toMatch(/realtimeCall = await createRealtimeCall/);
    expect(route).toMatch(/dispatchSidebandWorker[\s\S]*catch/);
    expect(route).toMatch(/if \(realtimeCall\?\.callId\)[\s\S]*hangUpRealtimeCall/);
    expect(route).toContain('"sideband_dispatch_failed"');
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

  it("starts the interviewer proactively and gives participants move-on guidance", () => {
    const client = readWorkspaceFile(
      "app",
      "interview",
      "created",
      "live-session-client.tsx",
    );
    const opening = readWorkspaceFile("lib", "interview", "live-opening.ts");
    const prompt = readWorkspaceFile("lib", "interview", "live-prompt.ts");

    expect(client).toContain('type: "response.create"');
    expect(client).toContain("INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS");
    expect(opening).toContain("Start speaking now");
    expect(opening).toContain("Read this opening exactly once");
    expect(opening).toContain("Thanks for making the time to talk");
    expect(opening).toContain("Do not add a second introduction");
    expect(prompt).toContain(
      "Do not begin speaking from the session setup instructions alone",
    );
    expect(prompt).toContain(
      "The application start event is the only trigger for the opening response",
    );
    expect(prompt).toContain("Initial opening script");
    expect(prompt).toContain("LIVE_INTERVIEW_OPENING_SCRIPT");
    expect(client).toContain("six big questions");
    expect(client).toContain("It may have follow-up questions on your");
    expect(client).toContain("pause for a second or two");
    expect(client).toContain("restrain its");
    expect(client).toContain("we are done with this question");
    expect(prompt).toContain(
      "Do not infer or complete the participant's answer from a partial response",
    );
    expect(client).toContain("echoCancellation: true");
    expect(client).toContain("noiseSuppression: true");
    expect(client).toContain("autoGainControl: true");
    expect(client).toContain("openingResponsePendingRef");
    expect(client).toMatch(/setMicrophoneEnabled\(false\)[\s\S]*sendInitialInterviewerResponse/);
    expect(client).toContain('parsed.type === "response.done"');
    expect(client).toContain('parsed.type === "response.audio.done"');
    expect(client).toContain('parsed.type === "output_audio_buffer.stopped"');
    expect(client).toContain("unmuteAfterOpeningResponse");
    expect(client).toContain("Thank you for participating.");
    expect(client).toContain("You may close this browser window.");
  });

  it("keeps the participant ready pages free of redundant Ready eyebrow labels", () => {
    const intake = readWorkspaceFile("app", "interview", "intake-flow.tsx");
    const created = readWorkspaceFile("app", "interview", "created", "page.tsx");

    expect(intake).not.toContain('<p className="eyebrow">Ready</p>');
    expect(created).not.toContain('<p className="eyebrow">Ready</p>');
  });

  it("applies the authorized closing override after the locked guide", () => {
    const prompt = readWorkspaceFile("lib", "interview", "live-prompt.ts");

    expect(prompt).toContain("Authorized MVP closing override");
    expect(prompt).toContain(
      "Do not provide a broad final synthesis or recap of the whole interview",
    );
    expect(prompt).toContain(
      "After the sixth objective, briefly recap only the participant's answer to that objective",
    );
    expect(prompt.indexOf("Authorized MVP closing override")).toBeGreaterThan(
      prompt.indexOf("Locked Interview Guide:"),
    );
  });
});
