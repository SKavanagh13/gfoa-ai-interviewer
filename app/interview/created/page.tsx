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
        <p className="eyebrow">Interview record created</p>
        <h1>Ready for Live Session Setup</h1>
        <p className="muted">
          The participant profile and consented interview record have been
          stored. You can begin the live voice session when the participant is
          ready.
        </p>
      </div>
      {params.interviewId ? (
        <>
          <section className="panel stack" aria-labelledby="created-heading">
            <h2 id="created-heading">Created interview</h2>
            <p className="record-id">{params.interviewId}</p>
          </section>
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
