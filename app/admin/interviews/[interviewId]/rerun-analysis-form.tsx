"use client";

import { useActionState } from "react";
import type { RerunAnalysisActionState } from "@/app/admin/action-state";
import { rerunAnalysisWithState } from "@/app/admin/actions";

const INITIAL_STATE: RerunAnalysisActionState = {
  status: "idle",
  message: null,
  analysisId: null,
};

export function RerunAnalysisForm({ interviewId }: { interviewId: string }) {
  const [state, formAction, pending] = useActionState(
    rerunAnalysisWithState,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="action-feedback-form">
      <input name="interviewId" type="hidden" value={interviewId} />
      <button className="secondary-button" disabled={pending} type="submit">
        {pending ? "Queueing Rerun..." : "Queue Analysis Rerun"}
      </button>
      {state.message ? (
        <p
          aria-live="polite"
          className={
            state.status === "failed" ? "form-error" : "form-success"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
