import Link from "next/link";
import { requireStaffOrAdmin } from "@/lib/admin/auth";
import {
  ADMIN_INTERVIEW_LIST_PAGE_SIZE,
  AdminRepository,
} from "@/lib/admin/repository";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";
import type { AdminInterviewListFilters } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await requireStaffOrAdmin();
  const query = await searchParams;
  const filters = parseFilters(query);
  const page = parsePositiveInteger(query.page);
  const repository = new AdminRepository(
    await createAuthenticatedSupabaseClient(),
  );
  const interviewList = await repository.loadInterviewList({
    filters,
    page,
    pageSize: ADMIN_INTERVIEW_LIST_PAGE_SIZE,
  });
  const interviews = interviewList.items;

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
          <span className="muted">
            {interviewList.totalCount} matching records
          </span>
        </div>
        <form action="/admin" className="admin-filter-grid">
          <FilterSelect
            label="Lifecycle"
            name="lifecycleStatus"
            options={LIFECYCLE_OPTIONS}
            value={interviewList.filters.lifecycleStatus}
          />
          <FilterSelect
            label="Disposition"
            name="endDisposition"
            options={END_DISPOSITION_OPTIONS}
            value={interviewList.filters.endDisposition}
          />
          <FilterSelect
            label="Transcript"
            name="transcriptStatus"
            options={TRANSCRIPT_OPTIONS}
            value={interviewList.filters.transcriptStatus}
          />
          <FilterSelect
            label="Eligibility"
            name="analysisEligibility"
            options={ANALYSIS_ELIGIBILITY_OPTIONS}
            value={interviewList.filters.analysisEligibility}
          />
          <FilterSelect
            label="Latest analysis"
            name="latestAnalysisStatus"
            options={LATEST_ANALYSIS_OPTIONS}
            value={interviewList.filters.latestAnalysisStatus}
          />
          <div className="admin-filter-actions">
            <button type="submit">Apply</button>
            <Link className="secondary-button button-link" href="/admin">
              Clear
            </Link>
          </div>
        </form>
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
        <div className="admin-pagination" aria-label="Interview list pages">
          {interviewList.page > 1 ? (
            <Link
              className="secondary-button button-link"
              href={adminListHref(interviewList.filters, interviewList.page - 1)}
            >
              Previous
            </Link>
          ) : (
            <span className="secondary-button button-link admin-pagination-disabled">
              Previous
            </span>
          )}
          <span className="muted">
            Page {interviewList.page} of {interviewList.totalPages}
          </span>
          {interviewList.page < interviewList.totalPages ? (
            <Link
              className="secondary-button button-link"
              href={adminListHref(interviewList.filters, interviewList.page + 1)}
            >
              Next
            </Link>
          ) : (
            <span className="secondary-button button-link admin-pagination-disabled">
              Next
            </span>
          )}
        </div>
      </section>
    </main>
  );
}

type FilterOption = {
  label: string;
  value: string;
};

const LIFECYCLE_OPTIONS: FilterOption[] = [
  { label: "Created", value: "created" },
  { label: "Active", value: "active" },
  { label: "Ending", value: "ending" },
  { label: "Ended", value: "ended" },
  { label: "Failed", value: "failed" },
];

const END_DISPOSITION_OPTIONS: FilterOption[] = [
  { label: "Completed", value: "completed" },
  { label: "Participant ended", value: "participant_ended" },
  { label: "Technical failure", value: "technical_failure" },
  { label: "Missing", value: "missing" },
];

const TRANSCRIPT_OPTIONS: FilterOption[] = [
  { label: "Pending", value: "pending" },
  { label: "Stabilizing", value: "stabilizing" },
  { label: "Stable", value: "stable" },
  { label: "Failed", value: "failed" },
];

const ANALYSIS_ELIGIBILITY_OPTIONS: FilterOption[] = [
  { label: "Eligible", value: "eligible" },
  {
    label: "Insufficient content",
    value: "ineligible_insufficient_content",
  },
  { label: "Missing", value: "missing" },
];

const LATEST_ANALYSIS_OPTIONS: FilterOption[] = [
  { label: "Pending", value: "pending" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
  { label: "Missing", value: "missing" },
];

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: keyof AdminInterviewListFilters;
  options: FilterOption[];
  value: string | null;
}) {
  return (
    <label className="admin-filter-field">
      <span>{label}</span>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): Partial<AdminInterviewListFilters> {
  return {
    analysisEligibility: singleParam(searchParams.analysisEligibility),
    endDisposition: singleParam(searchParams.endDisposition),
    latestAnalysisStatus: singleParam(searchParams.latestAnalysisStatus),
    lifecycleStatus: singleParam(searchParams.lifecycleStatus),
    transcriptStatus: singleParam(searchParams.transcriptStatus),
  } as Partial<AdminInterviewListFilters>;
}

function adminListHref(filters: AdminInterviewListFilters, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | string[] | undefined) {
  const candidate = Number(singleParam(value));
  return Number.isInteger(candidate) && candidate > 0 ? candidate : 1;
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
