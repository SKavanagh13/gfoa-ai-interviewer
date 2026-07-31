type CreatedInterviewPageProps = {
  searchParams: Promise<{
    interviewId?: string;
  }>;
};

export default async function CreatedInterviewPage({
  searchParams,
}: CreatedInterviewPageProps) {
  const params = await searchParams;

  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">Interview record created</p>
        <h1>Ready for Live Session Setup</h1>
        <p className="muted">
          The participant profile and consented interview record have been
          stored. The Realtime voice session is intentionally reserved for Wave
          3.
        </p>
      </div>
      {params.interviewId ? (
        <section className="panel stack" aria-labelledby="created-heading">
          <h2 id="created-heading">Created interview</h2>
          <p className="record-id">{params.interviewId}</p>
        </section>
      ) : null}
    </main>
  );
}
