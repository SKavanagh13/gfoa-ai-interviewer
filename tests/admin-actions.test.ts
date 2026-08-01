import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const revalidatePath = vi.fn();
const requireStaffOrAdmin = vi.fn();
const verifyInterviewAccessible = vi.fn();
const serviceRpc = vi.fn();
const runPostInterviewAnalysis = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({ requireStaffOrAdmin }));
vi.mock("@/lib/supabase/auth-server", () => ({
  createAuthenticatedSupabaseClient: vi.fn(async () => ({ auth: {} })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({ rpc: serviceRpc })),
}));
vi.mock("@/lib/analysis/runner", () => ({ runPostInterviewAnalysis }));
vi.mock("@/lib/admin/repository", () => ({
  AdminRepository: vi.fn().mockImplementation(() => ({
    verifyInterviewAccessible,
  })),
}));

const interviewId = "123e4567-e89b-12d3-a456-426614174000";

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("Wave 6 admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffOrAdmin.mockResolvedValue({ userId: "user-1", role: "staff" });
    verifyInterviewAccessible.mockResolvedValue(true);
    serviceRpc.mockResolvedValue({ error: null });
    runPostInterviewAnalysis.mockResolvedValue({
      status: "succeeded",
      analysisId: "analysis-1",
    });
  });

  it("checks authorization and RLS visibility before updating the negative flag RPC", async () => {
    const { setNegativeReactionFlag } = await import("@/app/admin/actions");

    await setNegativeReactionFlag(
      formData({ interviewId, negativeReactionFlag: "true" }),
    );

    expect(requireStaffOrAdmin).toHaveBeenCalledOnce();
    expect(verifyInterviewAccessible).toHaveBeenCalledWith(interviewId);
    expect(serviceRpc).toHaveBeenCalledWith("update_negative_reaction_flag", {
      p_interview_id: interviewId,
      p_value: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("does not call service-role RPCs when the interview is not visible through RLS", async () => {
    verifyInterviewAccessible.mockResolvedValue(false);
    const { setNegativeReactionFlag } = await import("@/app/admin/actions");

    await expect(
      setNegativeReactionFlag(
        formData({ interviewId, negativeReactionFlag: "false" }),
      ),
    ).rejects.toThrow("not accessible");

    expect(serviceRpc).not.toHaveBeenCalled();
  });

  it("checks authorization and RLS visibility before invoking the rerun entry point", async () => {
    const { rerunAnalysis } = await import("@/app/admin/actions");

    await rerunAnalysis(formData({ interviewId }));

    expect(requireStaffOrAdmin).toHaveBeenCalledOnce();
    expect(verifyInterviewAccessible).toHaveBeenCalledWith(interviewId);
    expect(runPostInterviewAnalysis).toHaveBeenCalledWith(interviewId);
  });

  it("rejects unauthenticated callers before rerun", async () => {
    requireStaffOrAdmin.mockRejectedValue(new Error("redirect:/admin/login"));
    const { rerunAnalysis } = await import("@/app/admin/actions");

    await expect(rerunAnalysis(formData({ interviewId }))).rejects.toThrow(
      "redirect:/admin/login",
    );

    expect(runPostInterviewAnalysis).not.toHaveBeenCalled();
  });
});
