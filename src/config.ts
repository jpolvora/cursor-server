import { z } from "zod";

const envSchema = z.object({
  CURSOR_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  REPOS_ROOT: z.string().default("./repos"),
  CURSOR_MODEL: z.string().default("composer-2"),
  SERVER_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  return envSchema.parse(process.env);
}

/** Merge optional overrides onto env config and re-validate with Zod. */
export function resolveConfig(overrides?: unknown): Config {
  if (overrides == null || typeof overrides !== "object" || Array.isArray(overrides)) {
    return loadConfig();
  }
  return envSchema.parse({ ...loadConfig(), ...overrides });
}
