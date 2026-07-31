import "server-only";

import { getServerEnv } from "@/lib/env";

export async function dispatchSidebandWorker(input: {
  interviewId: string;
  callId: string;
}): Promise<void> {
  const env = getServerEnv();
  const url = new URL("/sideband/start", env.SIDEBAND_WORKER_BASE_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Sideband worker dispatch failed with ${response.status}`);
  }
}
