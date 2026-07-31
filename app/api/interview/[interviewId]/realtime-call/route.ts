import { NextResponse } from "next/server";
import { createRealtimeCall } from "@/lib/openai/realtime";
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

  try {
    const realtimeCall = await createRealtimeCall({
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
    await repository.markTechnicalFailure(
      interviewId,
      error instanceof Error ? error.message : "Realtime session failed",
    );

    return NextResponse.json(
      { error: "Realtime session failed" },
      { status: 502 },
    );
  }
}
