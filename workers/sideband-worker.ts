import http from "node:http";
import { getServerRuntimeEnv } from "@/lib/server-runtime-env";
import { runSidebandController } from "@/lib/interview/sideband-controller";
import {
  SIDEBAND_DISPATCH_SECRET_HEADER,
  sidebandDispatchSecretMatches,
} from "@/lib/interview/sideband-dispatch-auth";
import { InterviewSessionRepository } from "@/lib/interview/session-repository";
import { createServiceRoleSupabaseRuntimeClient } from "@/lib/supabase/service-role";

const port = Number(process.env.SIDEBAND_WORKER_PORT ?? 8787);

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/sideband/start") {
    response.writeHead(404).end();
    return;
  }

  const env = getServerRuntimeEnv();
  const dispatchSecret = request.headers[SIDEBAND_DISPATCH_SECRET_HEADER];
  const providedSecret = Array.isArray(dispatchSecret)
    ? dispatchSecret[0]
    : dispatchSecret;

  if (
    !sidebandDispatchSecretMatches(env.SIDEBAND_DISPATCH_SECRET, providedSecret)
  ) {
    response.writeHead(401).end("Unauthorized");
    return;
  }

  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    try {
      const payload = JSON.parse(body) as {
        interviewId?: string;
        callId?: string;
      };

      if (!payload.interviewId || !payload.callId) {
        response.writeHead(400).end("interviewId and callId are required");
        return;
      }

      const repository = new InterviewSessionRepository(
        createServiceRoleSupabaseRuntimeClient(),
        env.PARTICIPANT_SESSION_TOKEN_SECRET,
        env.OPENAI_REALTIME_MODEL,
      );

      void runSidebandController({
        interviewId: payload.interviewId,
        callId: payload.callId,
        repository,
      }).catch((error) => {
        console.error("Sideband controller failed", error);
      });

      response.writeHead(202).end();
    } catch {
      response.writeHead(400).end("Invalid JSON");
    }
  });
});

server.listen(port, () => {
  console.log(`Wave 3 sideband worker listening on http://localhost:${port}`);
});
