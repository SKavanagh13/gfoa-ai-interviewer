import { NextResponse } from "next/server";
import { createAuthorizedParticipantRepository } from "@/lib/interview/route-auth";

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

  await repository.recordContinuationConsent(interviewId);

  return NextResponse.json({ ok: true });
}
