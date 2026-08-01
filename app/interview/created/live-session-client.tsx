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

      peerConnection.createDataChannel("oai-events");
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
        throw new Error("Could not start the voice session.");
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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
