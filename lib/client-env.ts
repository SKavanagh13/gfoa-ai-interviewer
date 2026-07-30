type EnvValue = string | undefined;

export type ClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

export const REQUIRED_CLIENT_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type ClientEnvKey = (typeof REQUIRED_CLIENT_ENV_KEYS)[number];

type EnvSource = Record<ClientEnvKey, EnvValue>;

export function validateClientEnv(source: EnvSource): ClientEnv {
  const missing = REQUIRED_CLIENT_ENV_KEYS.filter((key) => !source[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required client environment: ${missing.join(", ")}`);
  }

  const env = source as Record<ClientEnvKey, string>;

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getClientEnv(): ClientEnv {
  return validateClientEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
