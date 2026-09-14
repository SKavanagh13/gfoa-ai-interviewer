"use server";

import { revalidatePath } from "next/cache";
import type { RerunAnalysisActionState } from "@/app/admin/action-state";
import { requireStaffOrAdmin } from "@/lib/admin/auth";
import { AdminRepository } from "@/lib/admin/repository";
import { enqueuePostInterviewAnalysis } from "@/lib/analysis/runner";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/auth-server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function setNegativeReactionFlag(formData: FormData) {
  await requireStaffOrAdmin();

  const interviewId = requireInterviewId(formData);
  const value = parseBooleanFlag(formData.get("negativeReactionFlag"));
  const authenticatedSupabase = await createAuthenticatedSupabaseClient();
  const repository = new AdminRepository(authenticatedSupabase);
  const accessible = await repository.verifyInterviewAccessible(interviewId);

  if (!accessible) {
    throw new Error("Interview is not accessible to this reviewer.");
  }

  const { error } = await createServiceRoleSupabaseClient().rpc(
    "update_negative_reaction_flag",
    {
      p_interview_id: interviewId,
      p_value: value,
    },
  );

  if (error) {
    throw new Error(`Failed to update negative reaction flag: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/interviews/${interviewId}`);
}

export async function rerunAnalysis(formData: FormData) {
  const result = await enqueueAnalysisRerun(formData);

  if (!result.ok) {
    throw new Error(result.message);
  }
}

export async function rerunAnalysisWithState(
  _previousState: RerunAnalysisActionState,
  formData: FormData,
): Promise<RerunAnalysisActionState> {
  try {
    const result = await enqueueAnalysisRerun(formData);

    if (!result.ok) {
      return {
        status: "failed",
        message: result.message,
        analysisId: null,
      };
    }

    return {
      status: "queued",
      message: `Analysis rerun queued (${result.analysisId.slice(0, 8)}).`,
      analysisId: result.analysisId,
    };
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Failed to queue analysis rerun.",
      analysisId: null,
    };
  }
}

async function enqueueAnalysisRerun(
  formData: FormData,
): Promise<
  | { ok: true; analysisId: string }
  | { ok: false; message: string }
> {
  await requireStaffOrAdmin();

  const interviewId = requireInterviewId(formData);
  const authenticatedSupabase = await createAuthenticatedSupabaseClient();
  const repository = new AdminRepository(authenticatedSupabase);
  const accessible = await repository.verifyInterviewAccessible(interviewId);

  if (!accessible) {
    throw new Error("Interview is not accessible to this reviewer.");
  }

  const result = await enqueuePostInterviewAnalysis(interviewId);

  revalidatePath("/admin");
  revalidatePath(`/admin/interviews/${interviewId}`);

  if (result.status === "failed") {
    return { ok: false, message: result.errorMessage };
  }

  return { ok: true, analysisId: result.analysisId };
}

function requireInterviewId(formData: FormData): string {
  const interviewId = String(formData.get("interviewId") ?? "");

  if (!UUID_PATTERN.test(interviewId)) {
    throw new Error("A valid interview ID is required.");
  }

  return interviewId;
}

function parseBooleanFlag(value: FormDataEntryValue | null): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error("Negative reaction flag must be true or false.");
}
