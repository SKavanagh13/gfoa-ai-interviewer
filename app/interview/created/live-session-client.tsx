"use client";

import { useEffect, useRef, useState } from "react";
import { INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS } from "@/lib/interview/live-opening";

type LiveSessionClientProps = {
  interviewId: string;
  targetSeconds: number;
  hardCapSeconds: number;
  previewMode?: boolean;
};

type LiveState =
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

type RealtimeStartFailureReason =
  | "openai_realtime_call_failed"
  | "openai_realtime_call_missing_id"
  | "sideband_dispatch_failed"
  | "realtime_session_failed";

const PREINTERVIEW_GUIDANCE =
  'This is intended to feel like a conversational interview. There are six big questions the interview will cover. It may have follow-up questions on your answers, and it may pause for a second or two to make sure you are done talking before moving on. It will tell you when all the questions are complete, thank you, and ask you to end the interview. We have asked it to restrain its follow-ups so the conversation can cover each objective. If needed, you can say, "we are done with this question, let\'s move on."';

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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micCheckTimeoutRef = useRef<number | null>(null);
  const startEventSentRef = useRef(false);
  const openingResponsePendingRef = useRef(false);
  const openingUnmuteTimeoutRef = useRef<number | null>(null);

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
      await fetch(`/api/interview/${interviewId}/end`, {
        method: "POST",
      });
    } finally {
      setState("ended");
    }
  }

  async function continuePastTarget() {
    setError(null);

    if (previewMode) {
      setContinuationConsentedAt(new Date().toISOString());
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
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  function teardownBrowserMedia() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    startEventSentRef.current = false;
    openingResponsePendingRef.current = false;
    if (micCheckTimeoutRef.current) {
      window.clearTimeout(micCheckTimeoutRef.current);
      micCheckTimeoutRef.current = null;
    }
    if (openingUnmuteTimeoutRef.current) {
      window.clearTimeout(openingUnmuteTimeoutRef.current);
      openingUnmuteTimeoutRef.current = null;
    }
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
    if (!openingResponsePendingRef.current || typeof event.data !== "string") {
      return;
    }

    try {
      const parsed = JSON.parse(event.data) as { type?: unknown };
      if (
        parsed.type === "response.done" ||
        parsed.type === "response.audio.done" ||
        parsed.type === "output_audio_buffer.stopped"
      ) {
        unmuteAfterOpeningResponse();
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
    setMicrophoneEnabled(true);
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

  const visualState =
    state === "connecting" || state === "requesting_microphone"
      ? "connecting"
      : state === "ending"
        ? "processing"
        : state === "near_limit" || state === "awaiting_continuation_consent"
          ? "approaching"
          : "listening";

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
      <p className="lp-muted">{liveDescription(state, hardCapSeconds)}</p>

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
        className="lp-end-button"
        type="button"
        onClick={() => void endSession()}
        disabled={!canEnd}
      >
        End interview
      </button>
    </section>
  );
}

function statusLabel(state: LiveState): string {
  return state.replaceAll("_", " ");
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

function liveDescription(state: LiveState, hardCapSeconds: number): string {
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

  return "Speak naturally. The interviewer may pause briefly before asking the next question.";
}

async function readRealtimeStartFailure(
  response: Response,
): Promise<{
  reason: RealtimeStartFailureReason;
  openaiStatus: number | null;
  openaiCode: string | null;
}> {
  try {
    const body = (await response.json()) as {
      reason?: RealtimeStartFailureReason;
      openaiStatus?: number | null;
      openaiCode?: string | null;
    };

    return {
      reason: body.reason ?? "realtime_session_failed",
      openaiStatus: body.openaiStatus ?? null,
      openaiCode: body.openaiCode ?? null,
    };
  } catch {
    return {
      reason: "realtime_session_failed",
      openaiStatus: null,
      openaiCode: null,
    };
  }
}

function realtimeStartFailureMessage(failure: {
  reason: RealtimeStartFailureReason;
  openaiStatus: number | null;
  openaiCode: string | null;
}): string {
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
  state: "connecting" | "listening" | "processing" | "approaching";
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
