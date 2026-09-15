import { describe, expect, it, vi } from "vitest";
import {
  finalizeParticipantEnd,
  liveDescription,
  realtimeStartFailureMessage,
  liveVisualState,
  shouldAcceptPeerConnectionConnected,
  shouldFinalizeParticipantEndOnPageExit,
  shouldReportPeerConnectionFailure,
} from "@/app/interview/created/live-session-client";

describe("Live session participant cues", () => {
  it("shows a listening visual only when the participant microphone is open", () => {
    expect(liveVisualState("connected", true, false)).toBe("listening");
    expect(liveVisualState("connected", false, true)).toBe("speaking");
  });

  it("keeps timing and ending states visually distinct", () => {
    expect(liveVisualState("requesting_microphone", false, false)).toBe(
      "connecting",
    );
    expect(liveVisualState("near_limit", true, false)).toBe("approaching");
    expect(liveVisualState("ending", false, false)).toBe("processing");
  });

  it("explains interviewer speech without changing turn-taking behavior", () => {
    expect(liveDescription("connected", 1200, true)).toContain(
      "Your microphone will open automatically",
    );
  });

  it("shows configured live capacity and current use when the interview room is full", () => {
    expect(
      realtimeStartFailureMessage({
        reason: "live_interview_capacity_reached",
        activeInterviewCount: 20,
        maxActiveInterviews: 20,
        openaiStatus: null,
        openaiCode: null,
      }),
    ).toBe(
      "We can support 20 AI interviews at one time, and all 20 interviewers are currently in use. Please try again in a few minutes.",
    );
  });

  it("uses a keepalive request when finalizing participant end", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await finalizeParticipantEnd("interview-1", fetchImpl as never);

    expect(fetchImpl).toHaveBeenCalledWith("/api/interview/interview-1/end", {
      method: "POST",
      keepalive: true,
    });
  });

  it("retries server errors before keeping finalization pending", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    const wait = vi.fn(async () => {});

    await expect(
      finalizeParticipantEnd("interview-1", fetchImpl as never, { wait }),
    ).rejects.toThrow("The interview could not be finalized.");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(750);
    expect(wait).toHaveBeenCalledWith(1500);
  });

  it("uses sendBeacon as a final fallback for network finalization failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network failed");
    });
    const sendBeacon = vi.fn(() => true);

    await expect(
      finalizeParticipantEnd("interview-1", fetchImpl as never, {
        sendBeacon,
        wait: async () => {},
      }),
    ).resolves.toBeUndefined();
    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/interview/interview-1/end",
      expect.any(Blob),
    );
  });

  it("does not treat unauthorized participant-end requests as recoverable", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 }));
    const wait = vi.fn(async () => {});
    const sendBeacon = vi.fn(() => true);

    await expect(
      finalizeParticipantEnd("interview-1", fetchImpl as never, {
        sendBeacon,
        wait,
      }),
    ).rejects.toThrow("This interview session could not be verified.");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("attempts participant-end finalization when a live page exits", () => {
    expect(shouldFinalizeParticipantEndOnPageExit("connected")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("near_limit")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("failed")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("ended")).toBe(false);
    expect(shouldFinalizeParticipantEndOnPageExit("mic_ready")).toBe(false);
  });

  it("does not show connection-drop errors for intentional end teardown", () => {
    expect(shouldReportPeerConnectionFailure("connected", "failed")).toBe(true);
    expect(shouldReportPeerConnectionFailure("connected", "disconnected")).toBe(
      true,
    );
    expect(shouldReportPeerConnectionFailure("ending", "disconnected")).toBe(
      false,
    );
    expect(shouldReportPeerConnectionFailure("ended", "failed")).toBe(false);
  });

  it("ignores late peer connected events after the end flow starts", () => {
    expect(shouldAcceptPeerConnectionConnected("connecting")).toBe(true);
    expect(shouldAcceptPeerConnectionConnected("ending")).toBe(false);
    expect(shouldAcceptPeerConnectionConnected("ended")).toBe(false);
  });
});
