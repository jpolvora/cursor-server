import { z } from "zod";

export interface TenantConfig {
  id: string;
  apiKey: string;
  allowedRepos: string[];
}

export function parseTenants(raw: string | undefined): TenantConfig[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ""),
      apiKey: String(t.apiKey ?? ""),
      allowedRepos: Array.isArray(t.allowedRepos) ? t.allowedRepos.map(String) : [],
    })).filter((t) => t.id && t.apiKey);
  } catch {
    return [];
  }
}

export const envSchema = z.object({
  CURSOR_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  REPOS_ROOT: z.string().default("./repos"),
  CURSOR_MODEL: z.string().default("composer-2"),
  SERVER_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema> & { TENANTS: TenantConfig[] };

export function loadConfig(): Config {
  const env = envSchema.parse(process.env);
  const rawTenants = process.env.TENANTS;
  return { ...env, TENANTS: parseTenants(rawTenants) };
}

/** Merge optional overrides onto env config and re-validate with Zod. */
export function resolveConfig(overrides?: unknown): Config {
  if (overrides == null || typeof overrides !== "object" || Array.isArray(overrides)) {
    return loadConfig();
  }
  const env = loadConfig();
  const merged = { ...env, ...overrides };
  envSchema.parse(merged);
  return merged as Config;
}

export function configFromEnv(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.parse(env);
  return { ...parsed, TENANTS: parseTenants(env.TENANTS) };
}
