import { drainPendingAnalysisQueue } from "@/lib/analysis/runner";
import { finalizeStaleLiveInterviews } from "@/lib/worker/stale-session-finalizer";

async function main() {
  try {
    const staleInterviews = await finalizeStaleLiveInterviews();

    console.log(
      [
        `Scanned ${staleInterviews.scanned} stale live interview(s).`,
        `Finalized: ${staleInterviews.finalized}.`,
        `Failed: ${staleInterviews.failed}.`,
      ].join(" "),
    );

    for (const item of staleInterviews.results) {
      if (item.status === "finalized") {
        console.log(`finalized stale interview ${item.interviewId}`);
      } else {
        console.log(
          `failed stale interview ${item.interviewId} ${item.errorMessage}`,
        );
      }
    }
  } catch (error) {
    console.error("Stale live interview finalization failed", error);
  }

  const result = await drainPendingAnalysisQueue();

  console.log(
    [
      `Processed ${result.processed} pending analysis run(s).`,
      `Succeeded: ${result.succeeded}.`,
      `Failed: ${result.failed}.`,
      `Ineligible: ${result.ineligible}.`,
    ].join(" "),
  );

  for (const item of result.results) {
    if (item.status === "succeeded") {
      console.log(`succeeded ${item.analysisId}`);
    } else if (item.status === "failed") {
      console.log(
        `failed ${item.analysisId ?? "unknown"} ${item.errorMessage}`,
      );
    } else {
      console.log(`ineligible ${item.reason}`);
    }
  }
}

main().catch((error) => {
  console.error("Analysis worker failed", error);
  process.exitCode = 1;
});
