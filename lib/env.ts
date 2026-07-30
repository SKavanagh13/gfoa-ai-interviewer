type EnvValue = string | undefined;

export type ServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TRANSCRIPT_RECONCILIATION_TIMEOUT_MS: string;
};

export const REQUIRED_SERVER_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
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
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  };
}

export function getServerEnv(): ServerEnv {
  return validateServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TRANSCRIPT_RECONCILIATION_TIMEOUT_MS:
      process.env.TRANSCRIPT_RECONCILIATION_TIMEOUT_MS,
  });
}
