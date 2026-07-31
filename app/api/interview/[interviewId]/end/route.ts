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

  if (liveContext?.realtimeCallId) {
    try {
      await hangUpRealtimeCall(liveContext.realtimeCallId);
    } catch {
      // The local lifecycle still records the participant-ended observable path.
    }
  }

  await repository.markParticipantEnded(interviewId);

  return NextResponse.json({ ok: true });
}
