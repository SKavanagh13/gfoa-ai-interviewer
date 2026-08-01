import Link from "next/link";
import { requireStaffOrAdmin } from "@/lib/admin/auth";
import { AdminRepository } from "@/lib/admin/repository";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireStaffOrAdmin();
  const repository = new AdminRepository(
    await createAuthenticatedSupabaseClient(),
  );
  const interviews = await repository.loadInterviewList();

  return (
    <main className="page-shell stack admin-shell">
      <div className="split-row">
        <div>
          <p className="eyebrow">Wave 6</p>
        <h1>Admin Review</h1>
        <p className="muted">
            Review individual interview records, analysis history, transcript
            evidence, quote status, and method-experience flags.
        </p>
        </div>
        <span className="status-pill">{session.role}</span>
      </div>

      <section className="panel stack">
        <div className="split-row">
          <h2>Interviews</h2>
          <span className="muted">{interviews.length} records</span>
        </div>
        {interviews.length === 0 ? (
          <p className="muted">No interviews are visible to this account.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Interview</th>
                  <th>Lifecycle</th>
                  <th>Transcript</th>
                  <th>Latest analysis</th>
                  <th>Negative flag</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((interview) => (
                  <tr key={interview.interviewId}>
                    <td>
                      <Link
                        className="text-link"
                        href={`/admin/interviews/${interview.interviewId}`}
                      >
                        {shortId(interview.interviewId)}
                      </Link>
                    </td>
                    <td>{formatStatus(interview.lifecycleStatus)}</td>
                    <td>{formatStatus(interview.transcriptStatus)}</td>
                    <td>
                      {interview.latestAnalysisStatus
                        ? formatStatus(interview.latestAnalysisStatus)
                        : "Missing"}
                    </td>
                    <td>{formatBoolean(interview.negativeReactionFlag)}</td>
                    <td>{formatDate(interview.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatStatus(value: string | null) {
  return value ? value.replaceAll("_", " ") : "Missing";
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "Not set";
  }
  return value ? "Yes" : "No";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-US") : "Missing";
}
