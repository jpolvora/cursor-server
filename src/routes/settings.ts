import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { AGENTS } from "../agents.js";
import {
  APP_SETTING_KEYS,
  BOARD_LANES,
  boardDb,
} from "../services/board-db.js";

const HARNESS_RUNNERS = ["cursor-local", "cursor-sdk", "hermes", "opencode"] as const;

const SettingValueSchemas: Record<(typeof APP_SETTING_KEYS)[number], z.ZodType<string>> = {
  default_agent: z.enum(AGENTS as unknown as [string, ...string[]]),
  default_harness_runner: z.enum(HARNESS_RUNNERS),
  ui_theme: z.enum(["dark", "light"]),
  ui_density: z.enum(["comfortable", "compact"]),
  board_default_lane: z.enum(BOARD_LANES as unknown as [string, ...string[]]),
};

const PutSettingsSchema = z.object({
  settings: z.record(z.string(), z.string().max(256)).refine((obj) => Object.keys(obj).length > 0, {
    message: "settings must include at least one key",
  }),
});

/**
 * Protected settings API — host-level preference store (SQLite app_settings).
 */
export function createSettingsRoutes(_config: Config) {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({ settings: boardDb.listSettings() });
  });

  app.put("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PutSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
    }

    const partial = parsed.data.settings;
    for (const key of Object.keys(partial)) {
      if (!(APP_SETTING_KEYS as string[]).includes(key)) {
        return c.json({ error: `Unknown setting key: ${key}` }, 400);
      }
      const valueSchema = SettingValueSchemas[key as (typeof APP_SETTING_KEYS)[number]];
      const valueParsed = valueSchema.safeParse(partial[key]);
      if (!valueParsed.success) {
        return c.json(
          { error: `Invalid value for ${key}: ${valueParsed.error.issues[0]?.message ?? "invalid"}` },
          400,
        );
      }
    }

    const settings = boardDb.setSettings(partial);
    return c.json({ settings });
  });

  return app;
}
