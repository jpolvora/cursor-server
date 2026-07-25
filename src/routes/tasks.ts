import { Hono } from "hono";
import { z } from "zod";
import { resolveAgent } from "../agents.js";
import type { Config } from "../config.js";
import { runTask } from "../services/agent-runner.js";
import { validateRepoPath } from "../services/repo-validator.js";
import { taskStore } from "../services/task-store.js";
import { processTaskInBackground } from "../services/task-worker.js";

const createTaskSchema = z.object({
  prompt: z.string().min(1),
  repo: z.string().min(1),
  model: z.string().optional(),
  /** Agent role; unknown values fall back to `default` (generic). */
  agent: z.unknown().optional(),
  async: z.boolean().optional().default(true),
  source: z.enum(["ide", "hermes", "umbrel", "api"]).optional().default("api"),
  webhookUrl: z.string().url().optional(),
});

export function createTaskRoutes(config: Config) {
  const tasks = new Hono();

  // List tasks
  tasks.get("/", (c) => {
    const status = c.req.query("status");
    const repo = c.req.query("repo");
    const source = c.req.query("source");

    const list = taskStore.listTasks({ status, repo, source });
    return c.json({ tasks: list });
  });

  // Get task by ID
  tasks.get("/:id", (c) => {
    const id = c.req.param("id");
    const task = taskStore.getTask(id);

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.json(task);
  });

  // Create task (async by default, or sync if async: false)
  tasks.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }

    const validation = validateRepoPath(config.REPOS_ROOT, parsed.data.repo);
    if (!validation.valid || !validation.resolvedPath) {
      return c.json(
        { error: validation.error || "Invalid repository" },
        (validation.status as 400 | 404) || 400
      );
    }

    const agent = resolveAgent(parsed.data.agent);
    const model = parsed.data.model ?? config.CURSOR_MODEL;

    const task = taskStore.createTask({
      prompt: parsed.data.prompt,
      repo: parsed.data.repo,
      repoPath: validation.resolvedPath,
      agent,
      model,
      source: parsed.data.source,
      webhookUrl: parsed.data.webhookUrl,
    });

    if (parsed.data.async === false) {
      // Synchronous execution fallback
      const startTime = Date.now();
      taskStore.updateTask(task.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      try {
        const result = await runTask(config, {
          prompt: parsed.data.prompt,
          repoPath: validation.resolvedPath,
          model,
          agent,
        });

        const endTime = Date.now();
        const updated = taskStore.updateTask(task.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          durationMs: endTime - startTime,
          result,
        });

        return c.json(updated ?? result, 200);
      } catch (err) {
        const endTime = Date.now();
        const errorMessage = err instanceof Error ? err.message : "Task execution failed";
        taskStore.updateTask(task.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          durationMs: endTime - startTime,
          error: errorMessage,
        });
        return c.json({ error: errorMessage }, 500);
      }
    }

    // Async execution path
    processTaskInBackground(config, task.id);

    return c.json(
      {
        taskId: task.id,
        status: task.status,
        repo: task.repo,
        agent: task.agent,
        createdAt: task.createdAt,
      },
      202
    );
  });

  return tasks;
}
