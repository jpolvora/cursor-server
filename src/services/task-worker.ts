import type { Config } from "../config.js";
import { runTask } from "./agent-runner.js";
import { taskStore } from "./task-store.js";

const activeControllers = new Map<string, AbortController>();

export function getActiveTaskController(taskId: string): AbortController | undefined {
  return activeControllers.get(taskId);
}

export function cancelTask(taskId: string, reason = "Task cancelled"): boolean {
  const task = taskStore.getTask(taskId);
  if (!task) return false;

  const controller = activeControllers.get(taskId);
  if (controller) {
    controller.abort();
    activeControllers.delete(taskId);
  }

  if (task.status === "queued" || task.status === "running") {
    taskStore.updateTask(taskId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
      error: reason,
    });
    return true;
  }

  return false;
}

export function requeueTask(config: Config, taskId: string): boolean {
  const task = taskStore.getTask(taskId);
  if (!task) return false;

  if (task.status !== "cancelled" && task.status !== "failed") {
    return false;
  }

  taskStore.updateTask(taskId, {
    status: "queued",
    error: undefined,
    completedAt: undefined,
    startedAt: undefined,
    durationMs: undefined,
    result: undefined,
  });
  processTaskInBackground(config, taskId);
  return true;
}

async function sendWebhookNotification(webhookUrl: string, payload: unknown): Promise<void> {
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.warn(`Blocked invalid webhook protocol: ${url.protocol}`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Webhook to ${webhookUrl} returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.error(`Failed to send webhook notification to ${webhookUrl}:`, err);
  }
}

let skipBackgroundProcessingForTest = false;

export function setSkipBackgroundProcessingForTest(value: boolean): void {
  skipBackgroundProcessingForTest = value;
}

export function processTaskInBackground(config: Config, taskId: string): void {
  if (skipBackgroundProcessingForTest) {
    return;
  }
  // Fire and forget in the Node.js event loop
  setImmediate(async () => {
    const task = taskStore.getTask(taskId);
    if (!task || task.status !== "queued") {
      return;
    }

    const abortController = new AbortController();
    activeControllers.set(taskId, abortController);

    const startTime = Date.now();
    taskStore.updateTask(taskId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    taskStore.emitOutput(taskId, `[${new Date().toISOString()}] Task started: role=${task.agent}, model=${task.model}\n`);

    try {
      const result = await runTask(config, {
        prompt: task.prompt,
        repoPath: task.repoPath,
        model: task.model,
        agent: task.agent,
        tenantId: task.tenantId,
        mcpServers: task.mcpServers,
        signal: abortController.signal,
        onOutput: (chunk) => taskStore.emitOutput(taskId, chunk),
      });

      const endTime = Date.now();
      const updatedTask = taskStore.updateTask(taskId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        durationMs: endTime - startTime,
        result,
      });
      taskStore.emitOutput(taskId, `[${new Date().toISOString()}] Task completed in ${endTime - startTime}ms\n`);

      if (task.webhookUrl && updatedTask) {
        await sendWebhookNotification(task.webhookUrl, updatedTask);
      }
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : "Task execution failed";
      const wasCancelled =
        abortController.signal.aborted ||
        errorMessage.includes("aborted") ||
        errorMessage.includes("cancelled");

      if (!wasCancelled) {
        const updatedTask = taskStore.updateTask(taskId, {
          status: "failed",
          completedAt: new Date().toISOString(),
          durationMs: endTime - startTime,
          error: errorMessage,
        });
        taskStore.emitOutput(taskId, `[${new Date().toISOString()}] Task failed: ${errorMessage}\n`);

        if (task.webhookUrl && updatedTask) {
          await sendWebhookNotification(task.webhookUrl, updatedTask);
        }
      }
    } finally {
      activeControllers.delete(taskId);
    }
  });
}
