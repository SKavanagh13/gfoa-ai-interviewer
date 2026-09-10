import type { Database, Json } from "@/types/database.types";

export type AnalysisRunStatus = Database["public"]["Enums"]["analysis_run_status"];
export type AnalysisEligibility =
  Database["public"]["Enums"]["analysis_eligibility"];
export type EndDisposition = Database["public"]["Enums"]["end_disposition"];
export type InterviewLifecycleStatus =
  Database["public"]["Enums"]["interview_lifecycle_status"];
export type Objective = Database["public"]["Enums"]["objective"];
export type QuoteVerificationStatus =
  Database["public"]["Enums"]["quote_verification_status"];
export type TranscriptStatus = Database["public"]["Enums"]["transcript_status"];

export type AdminLatestAnalysisFilter = AnalysisRunStatus | "missing";

export type AdminInterviewListFilters = {
  analysisEligibility: AnalysisEligibility | "missing" | null;
  endDisposition: EndDisposition | "missing" | null;
  latestAnalysisStatus: AdminLatestAnalysisFilter | null;
  lifecycleStatus: InterviewLifecycleStatus | null;
  transcriptStatus: TranscriptStatus | null;
};

export type AdminInterviewListResult = {
  filters: AdminInterviewListFilters;
  items: AdminInterviewListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminParticipantContext = {
  participantId: string;
  governmentType: string | null;
  stateOrRegion: string | null;
  organizationSizeBand: string | null;
  experienceBand: string | null;
};

export type AdminParticipantIdentity = {
  participantId: string;
  email: string;
  name: string | null;
  gfoaMemberId: string | null;
  title: string | null;
  organizationName: string | null;
};

export type AdminInterviewListItem = {
  interviewId: string;
  lifecycleStatus: string;
  endDisposition: string | null;
  analysisEligibility: string | null;
  transcriptStatus: string;
  negativeReactionFlag: boolean | null;
  consentedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  latestAnalysisStatus: AnalysisRunStatus | null;
  latestAnalysisCreatedAt: string | null;
};

export type AdminTranscriptSegment = {
  segmentId: string;
  sequenceNumber: number;
  speaker: string;
  text: string;
  startTimeMs: number | null;
  endTimeMs: number | null;
  isFinal: boolean;
};

export type AdminAnalysisRunSummary = {
  analysisId: string;
  status: AnalysisRunStatus;
  analysisModel: string | null;
  analysisPromptVersion: string | null;
  outputSpecificationVersion: string | null;
  structuredSchemaVersion: string | null;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  estimatedAnalysisCostUsd: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AdminObjectiveEvidence = {
  segmentId: string;
};

export type AdminObjectiveResult = {
  objectiveResultId: string;
  objective: Objective;
  narrativeSummary: string;
  coverage: string;
  confidence: string;
  structuredFields: Json;
  evidence: AdminObjectiveEvidence[];
};

export type AdminQuoteSegment = {
  segmentId: string;
  startOffset: number | null;
  endOffset: number | null;
};

export type AdminQuote = {
  quoteId: string;
  quoteText: string;
  objective: Objective | null;
  verificationStatus: QuoteVerificationStatus;
  reasonSelected: string | null;
  segments: AdminQuoteSegment[];
};

export type AdminAnalysisRunDetail = AdminAnalysisRunSummary & {
  overallSummary: string | null;
  primaryTakeaway: string | null;
  additionalIssue: string | null;
  overallQuality: string | null;
  keyTension: string | null;
  recurringConcern: string | null;
  opportunitySignal: string | null;
  emergingSignal: string | null;
  limitations: string | null;
  objectiveResults: AdminObjectiveResult[];
  quotes: AdminQuote[];
};

export type AdminInterviewDetail = {
  interviewId: string;
  participantId: string;
  lifecycleStatus: string;
  endDisposition: string | null;
  analysisEligibility: string | null;
  analysisEligibilitySupportingObjective: Objective | null;
  transcriptStatus: string;
  transcriptProcessingError: string | null;
  negativeReactionFlag: boolean | null;
  consentVersion: string | null;
  consentedAt: string | null;
  continuationConsentedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  operatingPrinciplesVersion: string | null;
  interviewGuideVersion: string | null;
  livePromptVersion: string | null;
  audioStoragePath: string | null;
  transcriptStoragePath: string | null;
  browserConnectionStatus: string;
  sidebandConnectionStatus: string;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  estimatedLiveCostUsd: string | null;
  estimatedTotalCostUsd: string | null;
  costCategory: string | null;
  technicalError: string | null;
  createdAt: string;
  participantContext: AdminParticipantContext | null;
  transcriptSegments: AdminTranscriptSegment[];
  analysisRuns: AdminAnalysisRunSummary[];
  selectedAnalysisRun: AdminAnalysisRunDetail | null;
};
