import { z } from "zod";

export interface TenantConfig {
  id: string;
  apiKey: string;
  allowedRepos: string[];
}

export function parseTenants(raw: string | undefined): TenantConfig[] {
  if (!raw || !raw.trim()) {
    if (raw !== undefined) {
      console.warn("TENANTS env var is set but appears empty after trim");
    }
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`TENANTS env var must be a JSON array, got ${typeof parsed}`);
      return [];
    }
    const tenants = parsed.map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ""),
      apiKey: String(t.apiKey ?? ""),
      allowedRepos: Array.isArray(t.allowedRepos) ? t.allowedRepos.map(String) : [],
    })).filter((t) => t.id && t.apiKey);
    console.info(`Loaded ${tenants.length} tenant(s) from TENANTS env var`);
    return tenants;
  } catch (err) {
    console.error("Failed to parse TENANTS env var:", err);
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
  MCP_CONFIG_PATH: z.string().optional(),
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

