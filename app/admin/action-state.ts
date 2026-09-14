export type RerunAnalysisActionState = {
  status: "idle" | "queued" | "failed";
  message: string | null;
  analysisId: string | null;
};
