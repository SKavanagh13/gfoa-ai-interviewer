"use client";

import { useEffect, useRef, useState } from "react";

type LiveSessionClientProps = {
  interviewId: string;
  targetSeconds: number;
  hardCapSeconds: number;
};

type LiveState =
  | "ready"
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

const INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS =
  'Read this opening exactly once, then ask the first question exactly as written: "Thanks for making the time. I\'m here on behalf of GFOA; we\'re trying to understand what public finance professionals are seeing and experiencing in their jobs. This should take about fifteen minutes, and there are no right answers. To start, what is one issue that has been taking an unusual amount of your attention lately?" Do not add a second introduction or rephrase before the participant responds.';

export function LiveSessionClient({
  interviewId,
  targetSeconds,
  hardCapSeconds,
}: LiveSessionClientProps) {
  const [state, setState] = useState<LiveState>("ready");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [continuationConsentedAt, setContinuationConsentedAt] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startEventSentRef = useRef(false);

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

  async function startSession() {
    setError(null);
    setState("requesting_microphone");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
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
      setError(
        caught instanceof Error
          ? caught.message
          : "The live session could not be started.",
      );
    }
  }

  async function endSession() {
    if (state === "ending" || state === "ended") {
      return;
    }

    setState("ending");
    teardownBrowserMedia();

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
  }

  function sendInitialInterviewerResponse(dataChannel: RTCDataChannel) {
    if (startEventSentRef.current || dataChannel.readyState !== "open") {
      return;
    }

    startEventSentRef.current = true;
    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: INITIAL_INTERVIEWER_RESPONSE_INSTRUCTIONS,
        },
      }),
    );
  }

  const canStart =
    state === "ready" || state === "microphone_denied" || state === "failed";
  const canEnd =
    state === "connected" ||
    state === "near_limit" ||
    state === "awaiting_continuation_consent" ||
    state === "connecting";
  const canContinue =
    !continuationConsentedAt &&
    (state === "near_limit" || state === "awaiting_continuation_consent");

  return (
    <section className="panel stack" aria-labelledby="live-heading">
      <div className="split-row">
        <div>
          <h2 id="live-heading">Live voice session</h2>
          <p className="muted">
            The server captures finalized transcript events and enforces the
            20-minute cap.
          </p>
        </div>
        <div className="status-pill">{statusLabel(state)}</div>
      </div>

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

      {state === "ended" ? (
        <div className="session-notice" role="status">
          <p>
            <strong>Thank you for participating.</strong>
          </p>
          <p>You may close this browser window.</p>
        </div>
      ) : (
        <div className="session-notice">
          <p>
            There are six big questions the interview will cover. Select Start
            interview and wait for the interviewer to begin.
          </p>
          <p>
            The interviewer will ask the six questions one at a time and may ask
            follow-up questions. If it asks too many follow-ups, you can say,
            &quot;we are done with this question, let&apos;s move on.&quot;
          </p>
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      {canContinue ? (
        <div className="session-notice" role="status">
          <p>
            The interview is near its 15-minute target. Continue only if you are
            comfortable going a little longer.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void continuePastTarget()}
          >
            Continue a little longer
          </button>
        </div>
      ) : null}

      <div className="button-row">
        <button type="button" onClick={startSession} disabled={!canStart}>
          Start interview
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void endSession()}
          disabled={!canEnd}
        >
          End interview
        </button>
      </div>
    </section>
  );
}

function statusLabel(state: LiveState): string {
  return state.replaceAll("_", " ");
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

function realtimeStartFailureMessage(
  failure: {
    reason: RealtimeStartFailureReason;
    openaiStatus: number | null;
    openaiCode: string | null;
  },
): string {
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
