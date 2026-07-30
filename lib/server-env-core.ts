type EnvValue = string | undefined;

export type ServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: string;
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: string;
};

export const REQUIRED_SERVER_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRANSCRIPT_RECONCILIATION_TIMEOUT_MS",
] as const;

type ServerEnvKey = (typeof REQUIRED_SERVER_ENV_KEYS)[number];

type EnvSource = Record<ServerEnvKey, EnvValue>;

export function validateServerEnv(source: EnvSource): ServerEnv {
  const missing = REQUIRED_SERVER_ENV_KEYS.filter((key) => !source[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required server environment: ${missing.join(", ")}`);
  }

  const timeout = Number(source.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS);

  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error(
      "TRANSCRIPT_RECONCILIATION_TIMEOUT_MS must be a positive integer",
    );
  }

  const env = source as Record<ServerEnvKey, string>;

  return {
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  };
}
