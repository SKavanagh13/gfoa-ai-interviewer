import { describe, expect, it, vi } from "vitest";
import {
  finalizeParticipantEnd,
  liveDescription,
  realtimeStartFailureMessage,
  liveVisualState,
  shouldFinalizeParticipantEndOnPageExit,
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

  it("keeps finalization pending when participant end is not accepted", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      finalizeParticipantEnd("interview-1", fetchImpl as never),
    ).rejects.toThrow("The interview could not be finalized.");
  });

  it("attempts participant-end finalization when a live page exits", () => {
    expect(shouldFinalizeParticipantEndOnPageExit("connected")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("near_limit")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("failed")).toBe(true);
    expect(shouldFinalizeParticipantEndOnPageExit("ended")).toBe(false);
    expect(shouldFinalizeParticipantEndOnPageExit("mic_ready")).toBe(false);
  });
});
