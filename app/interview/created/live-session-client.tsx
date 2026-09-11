"use client";

import { useEffect, useRef, useState } from "react";
import { INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS } from "@/lib/interview/live-opening";

type LiveSessionClientProps = {
  interviewId: string;
  targetSeconds: number;
  hardCapSeconds: number;
  previewMode?: boolean;
};

export type LiveState =
  | "mic_check"
  | "mic_checking"
  | "mic_ready"
  | "requesting_microphone"
  | "connecting"
  | "connected"
  | "near_limit"
  | "awaiting_continuation_consent"
  | "ending"
  | "ended"
  | "microphone_denied"
  | "failed";

type LiveVisualState =
  | "connecting"
  | "listening"
  | "speaking"
  | "processing"
  | "approaching";

type RealtimeStartFailureReason =
  | "openai_realtime_call_failed"
  | "openai_realtime_call_missing_id"
  | "live_interview_capacity_reached"
  | "sideband_dispatch_failed"
  | "realtime_session_failed";

const PREINTERVIEW_GUIDANCE =
  'This is intended to feel like a conversational interview. There are six big questions the interview will cover. It may have follow-up questions on your answers. The interviewer may wait a second or two after you finish speaking so it does not cut you off. It will tell you when all the questions are complete, thank you, and ask you to end the interview. We have asked it to restrain its follow-ups so the conversation can cover each objective. If needed, you can say, "we are done with this question, let\'s move on."';
const INTERVIEWER_AUDIO_UNMUTE_FALLBACK_MS = 45000;

export function LiveSessionClient({
  interviewId,
  targetSeconds,
  hardCapSeconds,
  previewMode = false,
}: LiveSessionClientProps) {
  const [state, setState] = useState<LiveState>("mic_check");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [continuationConsentedAt, setContinuationConsentedAt] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const stateRef = useRef<LiveState>("mic_check");
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micCheckTimeoutRef = useRef<number | null>(null);
  const startEventSentRef = useRef(false);
  const openingResponsePendingRef = useRef(false);
  const openingUnmuteTimeoutRef = useRef<number | null>(null);
  const interviewerAudioPendingRef = useRef(false);
  const interviewerAudioUnmuteTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (previewMode) {
      return;
    }

    function finalizeOnPageExit() {
      if (!shouldFinalizeParticipantEndOnPageExit(stateRef.current)) {
        return;
      }

      const url = `/api/interview/${interviewId}/end`;

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([], { type: "text/plain" }));
        return;
      }

      void fetch(url, {
        method: "POST",
        keepalive: true,
      });
    }

    window.addEventListener("pagehide", finalizeOnPageExit);

    return () => {
      window.removeEventListener("pagehide", finalizeOnPageExit);
    };
  }, [interviewId, previewMode]);

  useEffect(() => {
    if (
      state !== "connected" &&
      state !== "near_limit" &&
      state !== "awaiting_continuation_consent"
    ) {
      return;
    }

    const startedAt = Date.now() - elapsedSeconds * 1000;
    const interval = window.setInterval(() => {
      const nextElapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(nextElapsed);

      if (nextElapsed >= hardCapSeconds) {
        void endSession();
      } else if (!continuationConsentedAt && nextElapsed >= targetSeconds) {
        clearInterviewerAudioUnmuteTimeout();
        interviewerAudioPendingRef.current = false;
        setMicrophoneEnabled(false);
        setState("awaiting_continuation_consent");
      } else if (
        !continuationConsentedAt &&
        nextElapsed >= Math.max(targetSeconds - 120, 0)
      ) {
        setState("near_limit");
      }
    }, 1000);

    return () => window.clearInterval(interval);
  });

  async function runMicCheck() {
    setError(null);
    setState("mic_checking");

    if (previewMode) {
      micCheckTimeoutRef.current = window.setTimeout(() => {
        setState("mic_ready");
      }, 900);
      return;
    }

    try {
      const stream = await getMicrophoneStream();
      localStreamRef.current = stream;
      setMicrophoneEnabled(false);
      micCheckTimeoutRef.current = window.setTimeout(() => {
        setState("mic_ready");
      }, 900);
    } catch (caught) {
      handleMicrophoneOrSessionFailure(caught, "The microphone could not be checked.");
    }
  }

  async function startSession() {
    setError(null);
    setState("requesting_microphone");

    if (previewMode) {
      setState("connecting");
      window.setTimeout(() => {
        setIsMicrophoneEnabled(true);
        setState("connected");
      }, 900);
      return;
    }

    try {
      const stream = localStreamRef.current ?? (await getMicrophoneStream());
      localStreamRef.current = stream;
      setMicrophoneEnabled(false);
      openingResponsePendingRef.current = true;
      setState("connecting");

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      audioRef.current = document.createElement("audio");
      audioRef.current.autoplay = true;
      peerConnection.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      stream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannel.addEventListener("open", () => {
        sendInitialInterviewerResponse(dataChannel);
      });
      dataChannel.addEventListener("message", handleRealtimeDataChannelMessage);
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          setState("connected");
          void fetch(`/api/interview/${interviewId}/browser-connected`, {
            method: "POST",
          });
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected"
        ) {
          setError("The connection dropped. Please reconnect or end for now.");
          setState("failed");
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await fetch(`/api/interview/${interviewId}/realtime-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sdpOffer: offer.sdp }),
      });

      if (!response.ok) {
        const failure = await readRealtimeStartFailure(response);
        throw new Error(realtimeStartFailureMessage(failure));
      }

      const data = (await response.json()) as { sdpAnswer: string };
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: data.sdpAnswer,
      });
    } catch (caught) {
      handleMicrophoneOrSessionFailure(
        caught,
        "The live session could not be started.",
      );
    }
  }

  async function endSession() {
    if (state === "ending" || state === "ended") {
      return;
    }

    setState("ending");
    teardownBrowserMedia();

    if (previewMode) {
      window.setTimeout(() => {
        setState("ended");
      }, 500);
      return;
    }

    try {
      await finalizeParticipantEnd(interviewId);
      setState("ended");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The interview could not be finalized.",
      );
      setState("failed");
    }
  }

  async function continuePastTarget() {
    setError(null);

    if (previewMode) {
      setContinuationConsentedAt(new Date().toISOString());
      setIsMicrophoneEnabled(true);
      setState("connected");
      return;
    }

    try {
      const response = await fetch(`/api/interview/${interviewId}/continue`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not record continuation consent.");
      }

      setContinuationConsentedAt(new Date().toISOString());
      setMicrophoneEnabled(true);
      setState("connected");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not record continuation consent.",
      );
    }
  }

  async function getMicrophoneStream() {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  function handleMicrophoneOrSessionFailure(caught: unknown, fallback: string) {
    teardownBrowserMedia();

    if (
      caught instanceof DOMException &&
      (caught.name === "NotAllowedError" ||
        caught.name === "PermissionDeniedError")
    ) {
      setState("microphone_denied");
      setError("Microphone permission is required to begin the interview.");
      return;
    }

    setState("failed");
    setError(caught instanceof Error ? caught.message : fallback);
  }

  function setMicrophoneEnabled(enabled: boolean) {
    setIsMicrophoneEnabled(enabled);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function teardownBrowserMedia() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setIsMicrophoneEnabled(false);
    startEventSentRef.current = false;
    openingResponsePendingRef.current = false;
    interviewerAudioPendingRef.current = false;
    setIsInterviewerSpeaking(false);
    if (micCheckTimeoutRef.current) {
      window.clearTimeout(micCheckTimeoutRef.current);
      micCheckTimeoutRef.current = null;
    }
    if (openingUnmuteTimeoutRef.current) {
      window.clearTimeout(openingUnmuteTimeoutRef.current);
      openingUnmuteTimeoutRef.current = null;
    }
    clearInterviewerAudioUnmuteTimeout();
  }

  function sendInitialInterviewerResponse(dataChannel: RTCDataChannel) {
    if (startEventSentRef.current || dataChannel.readyState !== "open") {
      return;
    }

    startEventSentRef.current = true;
    openingUnmuteTimeoutRef.current = window.setTimeout(() => {
      unmuteAfterOpeningResponse();
    }, 30000);
    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS,
        },
      }),
    );
  }

  function handleRealtimeDataChannelMessage(event: MessageEvent) {
    if (typeof event.data !== "string") {
      return;
    }

    try {
      const parsed = JSON.parse(event.data) as { type?: unknown };
      if (isInterviewerAudioStartEvent(parsed.type)) {
        muteForInterviewerAudio();
      }

      if (isInterviewerAudioDoneEvent(parsed.type)) {
        if (openingResponsePendingRef.current) {
          unmuteAfterOpeningResponse();
        }
        releaseInterviewerAudioMute();
      }
    } catch {
      return;
    }
  }

  function unmuteAfterOpeningResponse() {
    if (!openingResponsePendingRef.current) {
      return;
    }

    openingResponsePendingRef.current = false;
    if (openingUnmuteTimeoutRef.current) {
      window.clearTimeout(openingUnmuteTimeoutRef.current);
      openingUnmuteTimeoutRef.current = null;
    }
    enableMicrophoneIfAllowed();
  }

  function muteForInterviewerAudio() {
    interviewerAudioPendingRef.current = true;
    setIsInterviewerSpeaking(true);
    setMicrophoneEnabled(false);
    clearInterviewerAudioUnmuteTimeout();
    interviewerAudioUnmuteTimeoutRef.current = window.setTimeout(() => {
      releaseInterviewerAudioMute();
    }, INTERVIEWER_AUDIO_UNMUTE_FALLBACK_MS);
  }

  function releaseInterviewerAudioMute() {
    if (!interviewerAudioPendingRef.current) {
      return;
    }

    interviewerAudioPendingRef.current = false;
    setIsInterviewerSpeaking(false);
    clearInterviewerAudioUnmuteTimeout();
    enableMicrophoneIfAllowed();
  }

  function enableMicrophoneIfAllowed() {
    if (shouldKeepMicrophoneMuted()) {
      return;
    }

    setMicrophoneEnabled(true);
  }

  function shouldKeepMicrophoneMuted() {
    if (interviewerAudioPendingRef.current) {
      return true;
    }

    return [
      "mic_check",
      "mic_checking",
      "mic_ready",
      "awaiting_continuation_consent",
      "ending",
      "ended",
      "microphone_denied",
      "failed",
    ].includes(stateRef.current);
  }

  function clearInterviewerAudioUnmuteTimeout() {
    if (interviewerAudioUnmuteTimeoutRef.current) {
      window.clearTimeout(interviewerAudioUnmuteTimeoutRef.current);
      interviewerAudioUnmuteTimeoutRef.current = null;
    }
  }

  const canEnd =
    state === "connected" ||
    state === "near_limit" ||
    state === "awaiting_continuation_consent" ||
    state === "connecting";
  const canContinue =
    !continuationConsentedAt &&
    (state === "near_limit" || state === "awaiting_continuation_consent");

  if (
    state === "mic_check" ||
    state === "mic_checking" ||
    state === "mic_ready"
  ) {
    return (
      <section className="lp-card lp-card-narrow" aria-labelledby="mic-heading">
        <div className="lp-status-icon" aria-hidden="true">
          <SignalTower />
        </div>
        <h1 id="mic-heading">Check your microphone</h1>
        <p className="lp-muted">
          {previewMode
            ? "This is a local UI preview. You can continue without starting a real interview session."
            : "Say a few words so we can confirm your microphone is available before the interview begins."}
        </p>
        <div className="lp-talk-note lp-preinterview-note">
          <p>{PREINTERVIEW_GUIDANCE}</p>
        </div>
        <MicMeter active={state === "mic_checking" || state === "mic_ready"} />
        {state === "mic_ready" ? (
          <p className="lp-success-note" role="status">
            Microphone looks ready.
          </p>
        ) : null}
        <div className="lp-button-row">
          <button
            className="lp-button lp-button-secondary"
            type="button"
            onClick={() => void runMicCheck()}
            disabled={state === "mic_checking"}
          >
            {previewMode
              ? state === "mic_ready"
                ? "Preview again"
                : "Preview setup"
              : state === "mic_ready"
                ? "Test again"
                : "Check microphone"}
          </button>
          <button
            className="lp-button lp-button-primary"
            type="button"
            onClick={() => void startSession()}
            disabled={state !== "mic_ready"}
          >
            Continue
          </button>
        </div>
      </section>
    );
  }

  if (state === "microphone_denied") {
    return (
      <ErrorCard
        title="Microphone access is needed"
        body={error ?? "Enable microphone access in your browser, then try again."}
        primaryLabel="Try again"
        onPrimary={() => void runMicCheck()}
      />
    );
  }

  if (state === "failed") {
    return (
      <ErrorCard
        title="We could not connect"
        body={error ?? "The voice session could not be started."}
        primaryLabel="Reconnect"
        onPrimary={() => void startSession()}
        secondaryLabel="End for now"
        onSecondary={() => void endSession()}
      />
    );
  }

  if (state === "ended") {
    return (
      <section
        className="lp-card lp-card-narrow lp-centered"
        aria-labelledby="ended-heading"
      >
        <div className="lp-status-icon lp-status-icon-success" aria-hidden="true">
          {"\u2713"}
        </div>
        <h1 id="ended-heading">Thank you for sharing your perspective</h1>
        <p className="lp-muted">
          Thank you for participating. Your interview record has been saved.
          You may close this browser window.
        </p>
      </section>
    );
  }

  const visualState = liveVisualState(
    state,
    isMicrophoneEnabled,
    isInterviewerSpeaking,
  );

  return (
    <section className="lp-card lp-card-live" aria-labelledby="live-heading">
      <div className="lp-live-topline">
        <span className="lp-sr-status" role="status" aria-live="polite">
          {statusLabel(state)}
        </span>
        {elapsedSeconds > 0 ? (
          <span>{Math.max(1, Math.floor(elapsedSeconds / 60))} min elapsed</span>
        ) : (
          <span />
        )}
      </div>

      <LiveStatusVisual state={visualState} />
      <h1 id="live-heading">{liveHeading(state)}</h1>
      <p className="lp-muted">
        {liveDescription(state, hardCapSeconds, isInterviewerSpeaking)}
      </p>

      <div className="session-metrics" aria-label="Session timing">
        <div>
          <span className="metric-label">Elapsed</span>
          <strong>{formatDuration(elapsedSeconds)}</strong>
        </div>
        <div>
          <span className="metric-label">Target</span>
          <strong>{formatDuration(targetSeconds)}</strong>
        </div>
        <div>
          <span className="metric-label">Hard cap</span>
          <strong>{formatDuration(hardCapSeconds)}</strong>
        </div>
      </div>

      <PresenceCue
        isListening={isMicrophoneEnabled}
        isInterviewerSpeaking={isInterviewerSpeaking}
      />

      <MicStatus
        isEnabled={isMicrophoneEnabled}
        isInterviewerSpeaking={isInterviewerSpeaking}
      />

      {canContinue ? (
        <div className="lp-time-pill" role="status">
          We are coming up on time. Continue only if you are comfortable going
          a little longer.
          <button
            className="lp-inline-button"
            type="button"
            onClick={() => void continuePastTarget()}
          >
            Continue
          </button>
        </div>
      ) : null}

      {error ? <p className="lp-field-error">{error}</p> : null}

      <button
        className={
          state === "ending"
            ? "lp-end-button lp-end-button-complete"
            : "lp-end-button"
        }
        type="button"
        onClick={() => void endSession()}
        disabled={!canEnd}
      >
        {state === "ending" ? "Ending interview..." : "End interview"}
      </button>
    </section>
  );
}

function statusLabel(state: LiveState): string {
  return state.replaceAll("_", " ");
}

function isInterviewerAudioStartEvent(type: unknown): boolean {
  return (
    type === "response.audio.delta" ||
    type === "response.output_audio.delta" ||
    type === "output_audio_buffer.started"
  );
}

function isInterviewerAudioDoneEvent(type: unknown): boolean {
  return type === "output_audio_buffer.stopped";
}

function liveHeading(state: LiveState): string {
  if (state === "connecting" || state === "requesting_microphone") {
    return "Connecting you to the interviewer";
  }

  if (state === "near_limit" || state === "awaiting_continuation_consent") {
    return "Coming up on time";
  }

  if (state === "ending") {
    return "Ending the interview";
  }

  return "Interview in progress";
}

export function liveVisualState(
  state: LiveState,
  isMicrophoneEnabled: boolean,
  isInterviewerSpeaking: boolean,
): LiveVisualState {
  if (state === "connecting" || state === "requesting_microphone") {
    return "connecting";
  }

  if (state === "ending") {
    return "processing";
  }

  if (state === "near_limit" || state === "awaiting_continuation_consent") {
    return "approaching";
  }

  if (isInterviewerSpeaking || !isMicrophoneEnabled) {
    return "speaking";
  }

  return "listening";
}

export function liveDescription(
  state: LiveState,
  hardCapSeconds: number,
  isInterviewerSpeaking = false,
): string {
  if (state === "connecting" || state === "requesting_microphone") {
    return "This usually takes just a moment.";
  }

  if (state === "near_limit" || state === "awaiting_continuation_consent") {
    return `The session still has a hard cap of ${formatDuration(
      hardCapSeconds,
    )}.`;
  }

  if (state === "ending") {
    return "Saving the session state before closing the voice connection.";
  }

  if (isInterviewerSpeaking) {
    return "The interviewer is speaking. Your microphone will open automatically when it is your turn.";
  }

  return "Speak naturally. The interviewer may pause briefly before asking the next question.";
}

export async function finalizeParticipantEnd(
  interviewId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`/api/interview/${interviewId}/end`, {
    method: "POST",
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error(
      "The interview could not be finalized. Please try ending it again.",
    );
  }
}

export function shouldFinalizeParticipantEndOnPageExit(
  state: LiveState,
): boolean {
  return [
    "connecting",
    "connected",
    "near_limit",
    "awaiting_continuation_consent",
    "ending",
    "failed",
  ].includes(state);
}

async function readRealtimeStartFailure(
  response: Response,
): Promise<{
  activeInterviewCount: number | null;
  maxActiveInterviews: number | null;
  reason: RealtimeStartFailureReason;
  openaiStatus: number | null;
  openaiCode: string | null;
}> {
  try {
    const body = (await response.json()) as {
      activeInterviewCount?: number | null;
      maxActiveInterviews?: number | null;
      reason?: RealtimeStartFailureReason;
      openaiStatus?: number | null;
      openaiCode?: string | null;
    };

    return {
      activeInterviewCount:
        typeof body.activeInterviewCount === "number"
          ? body.activeInterviewCount
          : null,
      maxActiveInterviews:
        typeof body.maxActiveInterviews === "number"
          ? body.maxActiveInterviews
          : null,
      reason: body.reason ?? "realtime_session_failed",
      openaiStatus: body.openaiStatus ?? null,
      openaiCode: body.openaiCode ?? null,
    };
  } catch {
    return {
      activeInterviewCount: null,
      maxActiveInterviews: null,
      reason: "realtime_session_failed",
      openaiStatus: null,
      openaiCode: null,
    };
  }
}

export function realtimeStartFailureMessage(failure: {
  activeInterviewCount?: number | null;
  maxActiveInterviews?: number | null;
  reason: RealtimeStartFailureReason;
  openaiStatus: number | null;
  openaiCode: string | null;
}): string {
  if (failure.reason === "live_interview_capacity_reached") {
    if (
      typeof failure.maxActiveInterviews === "number" &&
      typeof failure.activeInterviewCount === "number"
    ) {
      return `We can support ${failure.maxActiveInterviews} AI interviews at one time, and all ${failure.activeInterviewCount} interviewers are currently in use. Please try again in a few minutes.`;
    }

    return "All AI interviewers are currently in use. Please try again in a few minutes.";
  }

  if (failure.reason === "sideband_dispatch_failed") {
    return "The voice session was created, but the server capture worker could not be reached or did not authorize the request.";
  }

  if (
    failure.reason === "openai_realtime_call_failed" ||
    failure.reason === "openai_realtime_call_missing_id"
  ) {
    const detail = [
      failure.openaiStatus ? `status ${failure.openaiStatus}` : null,
      failure.openaiCode ? `code ${failure.openaiCode}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return detail
      ? `OpenAI Realtime could not create the voice session (${detail}).`
      : "OpenAI Realtime could not create the voice session.";
  }

  return "Could not start the voice session.";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function MicMeter({ active }: { active: boolean }) {
  return (
    <div
      className={active ? "lp-meter lp-meter-active" : "lp-meter"}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function LiveStatusVisual({
  state,
}: {
  state: LiveVisualState;
}) {
  if (state === "processing") {
    return (
      <div className="lp-live-visual" aria-hidden="true">
        <span className="lp-processing-dots">
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }

  return (
    <div className={`lp-live-visual lp-live-${state}`} aria-hidden="true">
      <SignalTower animated />
    </div>
  );
}

function PresenceCue({
  isListening,
  isInterviewerSpeaking,
}: {
  isListening: boolean;
  isInterviewerSpeaking: boolean;
}) {
  const label = isListening
    ? "The interviewer is listening."
    : isInterviewerSpeaking
      ? "The interviewer is speaking."
      : "Waiting for the next turn.";

  return (
    <div className="lp-presence-cue" role="status" aria-live="polite">
      <span
        className={
          isListening
            ? "lp-presence-dot lp-presence-dot-active"
            : "lp-presence-dot"
        }
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

function MicStatus({
  isEnabled,
  isInterviewerSpeaking,
}: {
  isEnabled: boolean;
  isInterviewerSpeaking: boolean;
}) {
  const statusText = isEnabled
    ? "Mic on"
    : isInterviewerSpeaking
      ? "Interviewer speaking"
      : "Mic muted";
  const helperText = isEnabled
    ? "You can speak naturally now."
    : isInterviewerSpeaking
      ? "Your mic is paused so the interviewer can finish."
      : "This is automatic based on whose turn it is to speak.";

  return (
    <div
      className={
        isEnabled ? "lp-mic-status lp-mic-status-on" : "lp-mic-status lp-mic-status-muted"
      }
      role="status"
      aria-live="polite"
      aria-label={
        isEnabled
          ? "Microphone on. You can speak now."
          : isInterviewerSpeaking
            ? "Interviewer speaking. Microphone paused automatically."
            : "Microphone muted automatically."
      }
    >
      <span className="lp-mic-icon" aria-hidden="true">
        <span className="lp-mic-head" />
        <span className="lp-mic-stem" />
        <span className="lp-mic-base" />
      </span>
      <span className="lp-mic-status-copy">
        <strong>{statusText}</strong>
        <span>{helperText}</span>
      </span>
    </div>
  );
}

function ErrorCard({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section
      className="lp-card lp-card-narrow lp-centered"
      aria-labelledby="error-heading"
    >
      <div className="lp-status-icon lp-status-icon-error" aria-hidden="true">
        !
      </div>
      <h1 id="error-heading">{title}</h1>
      <p className="lp-muted">{body}</p>
      <div className="lp-button-row lp-button-row-center">
        <button
          className="lp-button lp-button-primary"
          type="button"
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            className="lp-button lp-button-secondary"
            type="button"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SignalTower({ animated = false }: { animated?: boolean }) {
  return (
    <span className={animated ? "lp-tower lp-tower-animated" : "lp-tower"}>
      {animated ? (
        <>
          <span className="lp-ring lp-ring-one" />
          <span className="lp-ring lp-ring-two" />
        </>
      ) : null}
      <span className="lp-tower-dot" />
      <span className="lp-tower-mast" />
      <span className="lp-tower-base" />
    </span>
  );
}
