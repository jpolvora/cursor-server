import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { resolveAgent } from "../agents.js";
import type { Config } from "../config.js";
import { runTask } from "../services/agent-runner.js";
import { validateRepoPath } from "../services/repo-validator.js";
import { taskStore } from "../services/task-store.js";
import { processTaskInBackground } from "../services/task-worker.js";
import type { McpServers } from "../services/mcp-config.js";
import { checkRepoAccess } from "../services/tenant-context.js";

const mcpServerSchema = z.record(
  z.string(),
  z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    type: z.string().optional(),
    cwd: z.string().optional(),
  }),
);

const createTaskSchema = z.object({
  prompt: z.string().min(1).max(100_000),
  repo: z.string().min(1),
  model: z.string().optional(),
  /** Agent role; unknown values fall back to `default` (generic). */
  agent: z.unknown().optional(),
  async: z.boolean().optional().default(true),
  source: z.enum(["ide", "hermes", "umbrel", "api"]).optional().default("api"),
  webhookUrl: z.string().url().optional(),
  /** MCP server overrides per task */
  mcpServers: mcpServerSchema.optional(),
});

export function createTaskRoutes(config: Config) {
  const tasks = new Hono();

  // List tasks
  tasks.get("/", (c) => {
    const status = c.req.query("status");
    const repo = c.req.query("repo");
    const source = c.req.query("source");
    const tenantId = c.get("tenantId") as string | undefined;

    const list = taskStore.listTasks({ status, repo, source, tenantId });
    return c.json({ tasks: list });
  });

  // Stream task status & log output via Server-Sent Events (SSE)
  tasks.get("/:id/stream", (c) => {
    const id = c.req.param("id");
    const task = taskStore.getTask(id);

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({ id: task.id, status: task.status, result: task.result, error: task.error }),
      });

      if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
        await stream.writeSSE({ event: "done", data: JSON.stringify({ id: task.id, status: task.status }) });
        return;
      }

      const onStatus = async (data: { id: string; status: string; record: any }) => {
        if (data.id === id) {
          try {
            await stream.writeSSE({
              event: "status",
              data: JSON.stringify({ id: data.id, status: data.status, result: data.record.result, error: data.record.error }),
            });
            if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
              await stream.writeSSE({ event: "done", data: JSON.stringify({ id: data.id, status: data.status }) });
              cleanup();
              stream.close();
            }
          } catch {
            cleanup();
          }
        }
      };

      const onOutput = async (data: { id: string; chunk: string }) => {
        if (data.id === id) {
          try {
            await stream.writeSSE({
              event: "output",
              data: JSON.stringify({ id: data.id, chunk: data.chunk }),
            });
          } catch {
            cleanup();
          }
        }
      };

      const cleanup = () => {
        taskStore.events.off("task:status", onStatus);
        taskStore.events.off("task:output", onOutput);
      };

      taskStore.events.on("task:status", onStatus);
      taskStore.events.on("task:output", onOutput);

      stream.onAbort(() => {
        cleanup();
      });

      while (!stream.aborted) {
        await stream.sleep(1000);
        const current = taskStore.getTask(id);
        if (current && (current.status === "completed" || current.status === "failed" || current.status === "cancelled")) {
          cleanup();
          break;
        }
      }
    });
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
      mcpServers: parsed.data.mcpServers as McpServers | undefined,
    });

    if (parsed.data.async === false) {
      // Synchronous execution fallback
      const startTime = Date.now();
      taskStore.updateTask(task.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      taskStore.emitOutput(task.id, `[${new Date().toISOString()}] Sync task started: role=${task.agent}, model=${task.model}\n`);

      try {
        const allowedRepos = c.get("allowedRepos") as string[] | undefined;
        const result = await runTask(config, {
          prompt: parsed.data.prompt,
          repoPath: validation.resolvedPath,
          model,
          agent,
          tenantId,
          allowedRepos,
          mcpServers: parsed.data.mcpServers as McpServers | undefined,
        });

        const endTime = Date.now();
        const updated = taskStore.updateTask(task.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          durationMs: endTime - startTime,
          result,
        });
        taskStore.emitOutput(task.id, `[${new Date().toISOString()}] Sync task completed in ${endTime - startTime}ms\n`);

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
        taskStore.emitOutput(task.id, `[${new Date().toISOString()}] Sync task failed: ${errorMessage}\n`);
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
