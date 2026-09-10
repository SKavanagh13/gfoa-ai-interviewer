import { drainPendingAnalysisQueue } from "@/lib/analysis/runner";

async function main() {
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
