import Link from "next/link";
import { notFound } from "next/navigation";
import { rerunAnalysis, setNegativeReactionFlag } from "@/app/admin/actions";
import { requireStaffOrAdmin } from "@/lib/admin/auth";
import { AdminRepository } from "@/lib/admin/repository";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";
import type {
  AdminAnalysisRunDetail,
  AdminInterviewDetail,
  AdminParticipantIdentity,
  AdminTranscriptSegment,
} from "@/lib/admin/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ interviewId: string }>;
  searchParams: Promise<{ analysisId?: string }>;
};

export default async function AdminInterviewPage({
  params,
  searchParams,
}: PageProps) {
  const [{ interviewId }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStaffOrAdmin(),
  ]);
  const repository = new AdminRepository(
    await createAuthenticatedSupabaseClient(),
  );
  const detail = await repository.loadInterviewDetail({
    interviewId,
    selectedAnalysisId: query.analysisId,
  });

  if (!detail) {
    notFound();
  }

  const identity =
    session.role === "admin"
      ? await repository.loadParticipantIdentity(interviewId)
      : null;

  return (
    <main className="page-shell stack admin-shell">
      <div className="split-row">
        <div>
          <p className="eyebrow">Admin Review</p>
          <h1>Interview {detail.interviewId.slice(0, 8)}</h1>
          <p className="muted">
            Profile-level identifiers are separated from analytical records.
            This is not guaranteed transcript de-identification; participants
            may speak identifying details during the interview.
          </p>
        </div>
        <Link className="secondary-button button-link" href="/admin">
          Back
        </Link>
      </div>

      <section className="admin-grid">
        <RecordPanel title="Lifecycle">
          <Definition label="Lifecycle" value={formatStatus(detail.lifecycleStatus)} />
          <Definition label="Disposition" value={formatStatus(detail.endDisposition)} />
          <Definition label="Eligibility" value={formatStatus(detail.analysisEligibility)} />
          <Definition
            label="Transcript"
            value={formatStatus(detail.transcriptStatus)}
          />
          <Definition
            label="Browser connection"
            value={formatStatus(detail.browserConnectionStatus)}
          />
          <Definition
            label="Sideband connection"
            value={formatStatus(detail.sidebandConnectionStatus)}
          />
          <Definition label="Technical error" value={detail.technicalError} />
          <Definition
            label="Transcript error"
            value={detail.transcriptProcessingError}
          />
        </RecordPanel>

        <RecordPanel title="Consent And Timing">
          <Definition label="Consent version" value={detail.consentVersion} />
          <Definition label="Consented at" value={formatDate(detail.consentedAt)} />
          <Definition
            label="Continuation consented at"
            value={formatDate(detail.continuationConsentedAt)}
          />
          <Definition label="Started" value={formatDate(detail.startedAt)} />
          <Definition label="Ended" value={formatDate(detail.endedAt)} />
          <Definition
            label="Duration"
            value={
              detail.durationSeconds === null
                ? null
                : `${detail.durationSeconds} seconds`
            }
          />
        </RecordPanel>
      </section>

      <section className="admin-grid">
        <RecordPanel title="Participant Context">
          <Definition
            label="Participant ID"
            value={detail.participantContext?.participantId ?? detail.participantId}
          />
          <Definition
            label="Government type"
            value={detail.participantContext?.governmentType}
          />
          <Definition
            label="State or region"
            value={detail.participantContext?.stateOrRegion}
          />
          <Definition
            label="Organization size band"
            value={detail.participantContext?.organizationSizeBand}
          />
          <Definition
            label="Experience band"
            value={detail.participantContext?.experienceBand}
          />
        </RecordPanel>

        <RecordPanel title="Admin Identity">
          {session.role === "admin" ? (
            <IdentityPanel identity={identity} />
          ) : (
            <p className="muted">
              Direct participant identifiers are only available to admin-role
              users.
            </p>
          )}
        </RecordPanel>
      </section>

      <section className="admin-grid">
        <RecordPanel title="Prompt Versions">
          <Definition
            label="Operating principles"
            value={detail.operatingPrinciplesVersion}
          />
          <Definition label="Interview guide" value={detail.interviewGuideVersion} />
          <Definition label="Live prompt" value={detail.livePromptVersion} />
          <Definition
            label="Analysis prompt"
            value={detail.selectedAnalysisRun?.analysisPromptVersion}
          />
          <Definition
            label="Output specification"
            value={detail.selectedAnalysisRun?.outputSpecificationVersion}
          />
          <Definition
            label="Structured schema"
            value={detail.selectedAnalysisRun?.structuredSchemaVersion}
          />
        </RecordPanel>

        <RecordPanel title="Usage And Cost">
          <Definition
            label="Live input tokens"
            value={formatNumber(detail.estimatedInputTokens)}
          />
          <Definition
            label="Live output tokens"
            value={formatNumber(detail.estimatedOutputTokens)}
          />
          <Definition label="Live cost" value={formatMoney(detail.estimatedLiveCostUsd)} />
          <Definition
            label="Analysis input tokens"
            value={formatNumber(detail.selectedAnalysisRun?.estimatedInputTokens)}
          />
          <Definition
            label="Analysis output tokens"
            value={formatNumber(detail.selectedAnalysisRun?.estimatedOutputTokens)}
          />
          <Definition
            label="Analysis cost"
            value={formatMoney(detail.selectedAnalysisRun?.estimatedAnalysisCostUsd)}
          />
          <Definition label="Total cost" value={formatMoney(detail.estimatedTotalCostUsd)} />
          <Definition label="Cost category" value={formatStatus(detail.costCategory)} />
        </RecordPanel>
      </section>

      <section className="panel stack">
        <div className="split-row">
          <h2>Reviewer Actions</h2>
          <span className="status-pill">
            Negative reaction: {formatBoolean(detail.negativeReactionFlag)}
          </span>
        </div>
        <div className="button-row">
          <form action={setNegativeReactionFlag}>
            <input name="interviewId" type="hidden" value={detail.interviewId} />
            <input name="negativeReactionFlag" type="hidden" value="true" />
            <button type="submit">Set Negative Reaction</button>
          </form>
          <form action={setNegativeReactionFlag}>
            <input name="interviewId" type="hidden" value={detail.interviewId} />
            <input name="negativeReactionFlag" type="hidden" value="false" />
            <button className="secondary-button" type="submit">
              Mark No Negative Reaction
            </button>
          </form>
          <form action={rerunAnalysis}>
            <input name="interviewId" type="hidden" value={detail.interviewId} />
            <button className="secondary-button" type="submit">
              Rerun Analysis
            </button>
          </form>
        </div>
      </section>

      <RecordPanel title="Private Files">
        <Definition label="Audio path" value={detail.audioStoragePath} />
        <Definition label="Transcript file path" value={detail.transcriptStoragePath} />
        <p className="muted">
          Interview file buckets are private. This MVP review surface displays
          object paths only and does not expose playable audio, public URLs, or
          file downloads. Canonical review uses the transcript segments below.
        </p>
      </RecordPanel>

      <AnalysisHistory detail={detail} />
      <SelectedAnalysis run={detail.selectedAnalysisRun} />
      <TranscriptPanel segments={detail.transcriptSegments} />
    </main>
  );
}

function AnalysisHistory({ detail }: { detail: AdminInterviewDetail }) {
  return (
    <section className="panel stack">
      <h2>Analysis Runs</h2>
      {detail.analysisRuns.length === 0 ? (
        <p className="muted">No analysis runs have been created.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Model</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {detail.analysisRuns.map((run) => (
                <tr key={run.analysisId}>
                  <td>
                    <Link
                      className="text-link"
                      href={`/admin/interviews/${detail.interviewId}?analysisId=${run.analysisId}`}
                    >
                      {run.analysisId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{formatStatus(run.status)}</td>
                  <td>{run.analysisModel ?? "Missing"}</td>
                  <td>{formatDate(run.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SelectedAnalysis({ run }: { run: AdminAnalysisRunDetail | null }) {
  if (!run) {
    return (
      <section className="panel stack">
        <h2>Selected Analysis</h2>
        <p className="muted">No selected analysis run is available.</p>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <div className="split-row">
        <h2>Selected Analysis</h2>
        <span className="status-pill">{formatStatus(run.status)}</span>
      </div>
      {run.status === "failed" ? (
        <p className="form-error">{run.errorMessage}</p>
      ) : null}
      <Definition label="Overall summary" value={run.overallSummary} />
      <Definition label="Primary takeaway" value={run.primaryTakeaway} />
      <Definition label="Additional issue" value={run.additionalIssue} />
      <Definition label="Overall quality" value={formatStatus(run.overallQuality)} />
      <Definition label="Limitations" value={run.limitations} />
      <Definition label="Key tension" value={run.keyTension} />
      <Definition label="Recurring concern" value={run.recurringConcern} />
      <Definition label="Opportunity signal" value={run.opportunitySignal} />
      <Definition label="Emerging signal" value={run.emergingSignal} />

      <div className="stack">
        <h3>Objectives</h3>
        {run.objectiveResults.length === 0 ? (
          <p className="muted">No objective rows are persisted for this run.</p>
        ) : (
          run.objectiveResults.map((objective) => (
            <article className="subpanel stack" key={objective.objectiveResultId}>
              <div className="split-row">
                <h4>{formatStatus(objective.objective)}</h4>
                <span className="status-pill">{objective.confidence}</span>
              </div>
              <p>{objective.narrativeSummary}</p>
              <Definition label="Coverage" value={formatStatus(objective.coverage)} />
              <Definition
                label="Structured fields"
                value={JSON.stringify(objective.structuredFields)}
              />
              <EvidenceLinks segmentIds={objective.evidence.map((item) => item.segmentId)} />
            </article>
          ))
        )}
      </div>

      <div className="stack">
        <h3>Quotes</h3>
        {run.quotes.length === 0 ? (
          <p className="muted">No quote proposals are persisted for this run.</p>
        ) : (
          run.quotes.map((quote) => (
            <article className="subpanel stack" key={quote.quoteId}>
              <blockquote>{quote.quoteText}</blockquote>
              <Definition
                label="Verification"
                value={formatStatus(quote.verificationStatus)}
              />
              <Definition label="Objective" value={formatStatus(quote.objective)} />
              <Definition label="Reason selected" value={quote.reasonSelected} />
              <EvidenceLinks segmentIds={quote.segments.map((item) => item.segmentId)} />
              {quote.segments.length > 0 ? (
                <p className="muted">
                  Offsets:{" "}
                  {quote.segments
                    .map((item) =>
                      item.startOffset === null || item.endOffset === null
                        ? "missing"
                        : `${item.startOffset}-${item.endOffset}`,
                    )
                    .join(", ")}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function TranscriptPanel({ segments }: { segments: AdminTranscriptSegment[] }) {
  return (
    <section className="panel stack">
      <h2>Canonical Transcript Segments</h2>
      {segments.length === 0 ? (
        <p className="muted">No transcript segments are visible.</p>
      ) : (
        segments.map((segment) => (
          <article
            className="transcript-segment"
            id={`segment-${segment.segmentId}`}
            key={segment.segmentId}
          >
            <div className="split-row">
              <strong>
                #{segment.sequenceNumber} {formatStatus(segment.speaker)}
              </strong>
              <span className="muted">
                {formatTimestamp(segment.startTimeMs)} to{" "}
                {formatTimestamp(segment.endTimeMs)}
              </span>
            </div>
            <p>{segment.text}</p>
          </article>
        ))
      )}
    </section>
  );
}

function IdentityPanel({
  identity,
}: {
  identity: AdminParticipantIdentity | null;
}) {
  if (!identity) {
    return <p className="muted">No identity record is visible.</p>;
  }

  return (
    <>
      <Definition label="Name" value={identity.name} />
      <Definition label="Email" value={identity.email} />
      <Definition label="GFOA member ID" value={identity.gfoaMemberId} />
      <Definition label="Title" value={identity.title} />
      <Definition label="Organization" value={identity.organizationName} />
    </>
  );
}

function RecordPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel stack">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Definition({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  return (
    <div className="definition-row">
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === "" ? "Missing" : value}</dd>
    </div>
  );
}

function EvidenceLinks({ segmentIds }: { segmentIds: string[] }) {
  if (segmentIds.length === 0) {
    return <p className="muted">No source segments persisted.</p>;
  }

  return (
    <p className="evidence-links">
      Evidence:{" "}
      {segmentIds.map((segmentId, index) => (
        <span key={segmentId}>
          <a href={`#segment-${segmentId}`}>segment {segmentId.slice(0, 8)}</a>
          {index < segmentIds.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

function formatStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Missing";
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "not set";
  }
  return value ? "yes" : "no";
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-US") : null;
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : String(value);
}

function formatMoney(value: string | null | undefined) {
  return value ? `$${value}` : null;
}

function formatTimestamp(value: number | null) {
  if (value === null) {
    return "unknown";
  }
  return `${value} ms`;
}
