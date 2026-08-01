type EnvValue = string | undefined;

export type ServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
  OPENAI_REALTIME_MODEL: string;
  OPENAI_ANALYSIS_MODEL: string;
  REALTIME_SESSION_TARGET_SECONDS: string;
  REALTIME_SESSION_HARD_CAP_SECONDS: string;
  SIDEBAND_CONNECTION_TIMEOUT_MS: string;
  SIDEBAND_DISPATCH_SECRET: string;
  PARTICIPANT_SESSION_TOKEN_SECRET: string;
  PARTICIPANT_SESSION_TOKEN_TTL_SECONDS: string;
  SIDEBAND_WORKER_BASE_URL: string;
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: string;
};

export const REQUIRED_SERVER_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_REALTIME_MODEL",
  "OPENAI_ANALYSIS_MODEL",
  "REALTIME_SESSION_TARGET_SECONDS",
  "REALTIME_SESSION_HARD_CAP_SECONDS",
  "SIDEBAND_CONNECTION_TIMEOUT_MS",
  "SIDEBAND_DISPATCH_SECRET",
  "PARTICIPANT_SESSION_TOKEN_SECRET",
  "PARTICIPANT_SESSION_TOKEN_TTL_SECONDS",
  "SIDEBAND_WORKER_BASE_URL",
  "TRANSCRIPT_RECONCILIATION_TIMEOUT_MS",
] as const;

type ServerEnvKey = (typeof REQUIRED_SERVER_ENV_KEYS)[number];

type EnvSource = Record<ServerEnvKey, EnvValue>;

export function validateServerEnv(source: EnvSource): ServerEnv {
  const missing = REQUIRED_SERVER_ENV_KEYS.filter((key) => !source[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required server environment: ${missing.join(", ")}`);
  }

  const targetSeconds = parsePositiveInteger(
    source.REALTIME_SESSION_TARGET_SECONDS,
    "REALTIME_SESSION_TARGET_SECONDS",
  );
  const hardCapSeconds = parsePositiveInteger(
    source.REALTIME_SESSION_HARD_CAP_SECONDS,
    "REALTIME_SESSION_HARD_CAP_SECONDS",
  );
  const sidebandTimeout = parsePositiveInteger(
    source.SIDEBAND_CONNECTION_TIMEOUT_MS,
    "SIDEBAND_CONNECTION_TIMEOUT_MS",
  );
  const participantTtlSeconds = parsePositiveInteger(
    source.PARTICIPANT_SESSION_TOKEN_TTL_SECONDS,
    "PARTICIPANT_SESSION_TOKEN_TTL_SECONDS",
  );
  const timeout = parsePositiveInteger(
    source.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
    "TRANSCRIPT_RECONCILIATION_TIMEOUT_MS",
  );

  if (hardCapSeconds <= targetSeconds) {
    throw new Error(
      "REALTIME_SESSION_HARD_CAP_SECONDS must be greater than REALTIME_SESSION_TARGET_SECONDS",
    );
  }

  if (hardCapSeconds > 1200) {
    throw new Error(
      "REALTIME_SESSION_HARD_CAP_SECONDS must not exceed 1200 seconds",
    );
  }

  if (participantTtlSeconds <= hardCapSeconds) {
    throw new Error(
      "PARTICIPANT_SESSION_TOKEN_TTL_SECONDS must be greater than REALTIME_SESSION_HARD_CAP_SECONDS",
    );
  }

  const env = source as Record<ServerEnvKey, string>;

  return {
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_REALTIME_MODEL: env.OPENAI_REALTIME_MODEL,
    OPENAI_ANALYSIS_MODEL: env.OPENAI_ANALYSIS_MODEL,
    REALTIME_SESSION_TARGET_SECONDS: String(targetSeconds),
    REALTIME_SESSION_HARD_CAP_SECONDS: String(hardCapSeconds),
    SIDEBAND_CONNECTION_TIMEOUT_MS: String(sidebandTimeout),
    SIDEBAND_DISPATCH_SECRET: env.SIDEBAND_DISPATCH_SECRET,
    PARTICIPANT_SESSION_TOKEN_SECRET: env.PARTICIPANT_SESSION_TOKEN_SECRET,
    PARTICIPANT_SESSION_TOKEN_TTL_SECONDS: String(participantTtlSeconds),
    SIDEBAND_WORKER_BASE_URL: env.SIDEBAND_WORKER_BASE_URL,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      String(timeout),
  };
}

function parsePositiveInteger(value: EnvValue, key: ServerEnvKey): number {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return numberValue;
}
