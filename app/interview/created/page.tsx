import { getServerEnv } from "@/lib/env";
import { LiveSessionClient } from "@/app/interview/created/live-session-client";

type CreatedInterviewPageProps = {
  searchParams: Promise<{
    interviewId?: string;
    preview?: string;
  }>;
};

export default async function CreatedInterviewPage({
  searchParams,
}: CreatedInterviewPageProps) {
  const params = await searchParams;
  const previewMode =
    process.env.NODE_ENV !== "production" && params.preview === "1";
  const timing = previewMode
    ? {
        targetSeconds: 15 * 60,
        hardCapSeconds: 20 * 60,
      }
    : (() => {
        const env = getServerEnv();

        return {
          targetSeconds: Number(env.REALTIME_SESSION_TARGET_SECONDS),
          hardCapSeconds: Number(env.REALTIME_SESSION_HARD_CAP_SECONDS),
        };
      })();

  return (
    <main className="listening-page-shell">
      {params.interviewId ? (
        <LiveSessionClient
          interviewId={params.interviewId}
          targetSeconds={timing.targetSeconds}
          hardCapSeconds={timing.hardCapSeconds}
          previewMode={previewMode}
        />
      ) : null}
    </main>
  );
}
