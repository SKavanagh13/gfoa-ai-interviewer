import { NextResponse } from "next/server";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";
import { hangUpRealtimeCall } from "@/lib/openai/realtime";

type RouteContext = {
  params: Promise<{
    interviewId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { interviewId } = await context.params;
  const repository = await createAuthorizedParticipantRepository(interviewId);

  if (!repository) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const liveContext = await repository.getLiveInterviewContext(interviewId);

  await repository.markParticipantEnded(interviewId);

  if (liveContext?.realtimeCallId) {
    try {
      await hangUpRealtimeCall(liveContext.realtimeCallId);
    } catch {
      // Local lifecycle finalization has already been recorded.
    }
  }

  return NextResponse.json({ ok: true });
}
