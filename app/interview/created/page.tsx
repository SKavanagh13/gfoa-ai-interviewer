import { getServerEnv } from "@/lib/env";
import { LiveSessionClient } from "@/app/interview/created/live-session-client";

type CreatedInterviewPageProps = {
  searchParams: Promise<{
    interviewId?: string;
  }>;
};

export default async function CreatedInterviewPage({
  searchParams,
}: CreatedInterviewPageProps) {
  const params = await searchParams;
  const env = getServerEnv();

  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">Ready</p>
        <h1>Ready for the Interview</h1>
        <p className="muted">
          You can begin the live voice session when you are ready.
        </p>
      </div>
      {params.interviewId ? (
        <>
          <LiveSessionClient
            interviewId={params.interviewId}
            targetSeconds={Number(env.REALTIME_SESSION_TARGET_SECONDS)}
            hardCapSeconds={Number(env.REALTIME_SESSION_HARD_CAP_SECONDS)}
          />
        </>
      ) : null}
    </main>
  );
}
