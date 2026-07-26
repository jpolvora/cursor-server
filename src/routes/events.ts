import { Hono } from "hono";
import { z } from "zod";
import { resolveAgent } from "../agents.js";
import type { Config } from "../config.js";
import { validateRepoPath } from "../services/repo-validator.js";
import { taskStore } from "../services/task-store.js";
import { processTaskInBackground } from "../services/task-worker.js";
import { checkRepoAccess } from "../services/tenant-context.js";

/** Default event type when clients omit `event` (generic task ingestion). */
export const DEFAULT_EVENT_TYPE = "task";

const createEventSchema = z.object({
  event: z.string().min(1).default(DEFAULT_EVENT_TYPE),
  source: z.enum(["hermes", "umbrel", "ide", "api"]).default("api"),
  prompt: z.string().min(1).max(100_000),
  repo: z.string().min(1),
  model: z.string().optional(),
  agent: z.unknown().optional(),
  webhookUrl: z.string().url().optional(),
});

export function createEventRoutes(config: Config) {
  const events = new Hono();

  events.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid event payload", details: parsed.error.flatten() }, 400);
    }

    const validation = validateRepoPath(config.REPOS_ROOT, parsed.data.repo);
    if (!validation.valid || !validation.resolvedPath) {
      return c.json(
        { error: validation.error || "Invalid repository" },
        (validation.status as 400 | 404) || 400
      );
    }

    const accessError = checkRepoAccess(c.get("allowedRepos") as string[] ?? [], parsed.data.repo);
    if (accessError) {
      return c.json({ error: accessError }, 403);
    }

    const agent = resolveAgent(parsed.data.agent);
    const model = parsed.data.model ?? config.CURSOR_MODEL;
    const tenantId = c.get("tenantId") as string;

    const task = taskStore.createTask({
      tenantId,
      prompt: parsed.data.prompt,
      repo: parsed.data.repo,
      repoPath: validation.resolvedPath,
      agent,
      model,
      source: parsed.data.source,
      webhookUrl: parsed.data.webhookUrl,
    });

    processTaskInBackground(config, task.id);

    return c.json(
      {
        taskId: task.id,
        status: task.status,
        event: parsed.data.event,
        source: task.source,
        repo: task.repo,
        agent: task.agent,
      },
      202
    );
  });

  return events;
}
