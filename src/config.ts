import { z } from "zod";

export interface TenantConfig {
  id: string;
  apiKey: string;
  allowedRepos: string[];
  /** Optional per-tenant CPU limit (fraction of one core, e.g. 0.5). */
  cpuLimit?: number;
  /** Optional per-tenant memory cap in megabytes. */
  memoryLimitMb?: number;
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
      cpuLimit: typeof t.cpuLimit === "number" ? t.cpuLimit : undefined,
      memoryLimitMb: typeof t.memoryLimitMb === "number" ? t.memoryLimitMb : undefined,
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
  /** Default CPU limit for tenant agent runs (fraction of one core). Overridable per tenant in TENANTS JSON. */
  TENANT_CPU_LIMIT: z.coerce.number().positive().optional(),
  /** Default memory limit for tenant agent runs (MB). Overridable per tenant in TENANTS JSON. */
  TENANT_MEMORY_LIMIT_MB: z.coerce.number().positive().optional(),
  /** When true, register pr-diff-review and repo-hygiene-check cron jobs at startup. Default off. */
  SCHEDULED_REVIEW_JOBS: z
    .preprocess((val) => val === true || val === "true" || val === "1", z.boolean())
    .default(false),
  /** Optional agent id for Agent.resume on scheduled pr-diff-review runs. */
  SCHEDULED_REVIEW_RESUME_AGENT_ID: z.string().min(1).optional(),
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

