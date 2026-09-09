import { describe, expect, it } from "vitest";
import {
  liveDescription,
  liveVisualState,
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
});
