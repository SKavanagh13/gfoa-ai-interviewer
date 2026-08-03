import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { buildLiveInterviewPrompt } from "@/lib/interview/live-prompt";

export type RealtimeCallResult = {
  sdpAnswer: string;
  callId: string;
};

export class RealtimeCallCreationError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiMessage: string | null,
    public readonly apiCode: string | null,
  ) {
    super(
      [
        `Realtime call creation failed with ${status}`,
        apiCode ? `code=${apiCode}` : null,
        apiMessage,
      ]
        .filter(Boolean)
        .join(": "),
    );
  }
}

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
          eagerness: "low",
          create_response: true,
          interrupt_response: false,
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

  form.set("sdp", input.sdpOffer);
  form.set("session", JSON.stringify(buildRealtimeSessionPayload(input)));

  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const apiError = await readOpenAiError(response);
    throw new RealtimeCallCreationError(
      response.status,
      apiError.message,
      apiError.code,
    );
  }

  const sdpAnswer = await response.text();
  const callId = parseRealtimeCallId(response.headers.get("Location"));

  if (!callId) {
    throw new Error("Realtime call creation did not return a call ID");
  }

  return { sdpAnswer, callId };
}

async function readOpenAiError(
  response: Response,
): Promise<{ message: string | null; code: string | null }> {
  try {
    const raw = (await response.json()) as {
      error?: {
        message?: unknown;
        code?: unknown;
      };
    };

    return {
      message:
        typeof raw.error?.message === "string" ? raw.error.message : null,
      code: typeof raw.error?.code === "string" ? raw.error.code : null,
    };
  } catch {
    return { message: null, code: null };
  }
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
