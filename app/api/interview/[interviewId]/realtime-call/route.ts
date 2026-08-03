import { NextResponse } from "next/server";
import {
  createRealtimeCall,
  hangUpRealtimeCall,
  type RealtimeCallResult,
} from "@/lib/openai/realtime";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";
import { dispatchSidebandWorker } from "@/lib/interview/sideband-dispatcher";

type RouteContext = {
  params: Promise<{
    interviewId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { interviewId } = await context.params;
  const repository = await createAuthorizedParticipantRepository(interviewId);

  if (!repository) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sdpOffer } = (await request.json()) as { sdpOffer?: string };

  if (!sdpOffer?.trim()) {
    return NextResponse.json({ error: "SDP offer is required" }, { status: 400 });
  }

  const liveContext = await repository.getLiveInterviewContext(interviewId);

  if (!liveContext) {
    return NextResponse.json(
      { error: "Consented interview was not found" },
      { status: 404 },
    );
  }

  let realtimeCall: RealtimeCallResult | null = null;

  try {
    realtimeCall = await createRealtimeCall({
      sdpOffer,
      participantContext: liveContext.participantContext,
    });

    await repository.persistRealtimeCallId(interviewId, realtimeCall.callId);
    await dispatchSidebandWorker({
      interviewId,
      callId: realtimeCall.callId,
    });

    return NextResponse.json({ sdpAnswer: realtimeCall.sdpAnswer });
  } catch (error) {
    const reason = realtimeStartFailureReason(error);

    if (realtimeCall?.callId) {
      await hangUpRealtimeCall(realtimeCall.callId).catch(() => undefined);
    }

    console.error("Realtime session failed", {
      interviewId,
      reason,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    await repository.markTechnicalFailure(
      interviewId,
      error instanceof Error ? error.message : "Realtime session failed",
    );

    return NextResponse.json(
      { error: "Realtime session failed", reason },
      { status: 502 },
    );
  }
}

type RealtimeStartFailureReason =
  | "openai_realtime_call_failed"
  | "openai_realtime_call_missing_id"
  | "sideband_dispatch_failed"
  | "realtime_session_failed";

function realtimeStartFailureReason(error: unknown): RealtimeStartFailureReason {
  if (!(error instanceof Error)) {
    return "realtime_session_failed";
  }

  if (error.message.startsWith("Sideband worker dispatch failed with")) {
    return "sideband_dispatch_failed";
  }

  if (error.message.startsWith("Realtime call creation failed with")) {
    return "openai_realtime_call_failed";
  }

  if (error.message === "Realtime call creation did not return a call ID") {
    return "openai_realtime_call_missing_id";
  }

  return "realtime_session_failed";
}
