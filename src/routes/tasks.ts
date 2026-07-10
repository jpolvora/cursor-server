import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { runTask } from "../services/agent-runner.js";

const createTaskSchema = z.object({
  prompt: z.string().min(1),
  repo: z.string().min(1),
  model: z.string().optional(),
});

export function createTaskRoutes(config: Config) {
  const tasks = new Hono();

  tasks.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }

    const repoPath = `${config.REPOS_ROOT}/${parsed.data.repo}`.replace(/\\/g, "/");

    try {
      const result = await runTask(config, {
        prompt: parsed.data.prompt,
        repoPath,
        model: parsed.data.model,
      });

      return c.json(result, 202);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Task execution failed";
      return c.json({ error: message }, 500);
    }
  });

  return tasks;
}
