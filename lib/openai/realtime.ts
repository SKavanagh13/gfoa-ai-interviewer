import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { buildLiveInterviewPrompt } from "@/lib/interview/live-prompt";

export type RealtimeCallResult = {
  sdpAnswer: string;
  callId: string;
};

export type CreateRealtimeCallInput = {
  sdpOffer: string;
  participantContext?: {
    governmentType?: string | null;
    stateOrRegion?: string | null;
    organizationSizeBand?: string | null;
    experienceBand?: string | null;
  };
};

export function buildRealtimeSessionPayload(input: CreateRealtimeCallInput) {
  const env = getServerRuntimeEnv();

  return {
    type: "realtime",
    model: env.OPENAI_REALTIME_MODEL,
    instructions: buildLiveInterviewPrompt({
      ...input.participantContext,
      targetSeconds: Number(env.REALTIME_SESSION_TARGET_SECONDS),
      hardCapSeconds: Number(env.REALTIME_SESSION_HARD_CAP_SECONDS),
    }),
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: "marin",
      },
    },
    output_modalities: ["audio"],
    tool_choice: "none",
    tools: [],
  };
}

export async function createRealtimeCall(
  input: CreateRealtimeCallInput,
  fetchImpl: typeof fetch = fetch,
): Promise<RealtimeCallResult> {
  const env = getServerRuntimeEnv();
  const form = new FormData();

  form.set("sdp", new Blob([input.sdpOffer], { type: "application/sdp" }));
  form.set(
    "session",
    new Blob([JSON.stringify(buildRealtimeSessionPayload(input))], {
      type: "application/json",
    }),
  );

  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Realtime call creation failed with ${response.status}`);
  }

  const sdpAnswer = await response.text();
  const callId = parseRealtimeCallId(response.headers.get("Location"));

  if (!callId) {
    throw new Error("Realtime call creation did not return a call ID");
  }

  return { sdpAnswer, callId };
}

export async function hangUpRealtimeCall(
  callId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const env = getServerRuntimeEnv();
  const response = await fetchImpl(
    `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Realtime call hangup failed with ${response.status}`);
  }
}

export function parseRealtimeCallId(location: string | null): string | null {
  if (!location) {
    return null;
  }

  const callId = location.split("/").filter(Boolean).at(-1);
  return callId?.startsWith("rtc_") ? callId : null;
}
