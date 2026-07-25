import type { Config } from "../config.js";
import { runTask } from "./agent-runner.js";
import { taskStore } from "./task-store.js";

async function sendWebhookNotification(webhookUrl: string, payload: unknown): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Failed to send webhook notification to ${webhookUrl}:`, err);
  }
}

export function processTaskInBackground(config: Config, taskId: string): void {
  // Fire and forget in the Node.js event loop
  setImmediate(async () => {
    const task = taskStore.getTask(taskId);
    if (!task || task.status !== "queued") {
      return;
    }

    const startTime = Date.now();
    taskStore.updateTask(taskId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    try {
      const result = await runTask(config, {
        prompt: task.prompt,
        repoPath: task.repoPath,
        model: task.model,
        agent: task.agent,
      });

      const endTime = Date.now();
      const updatedTask = taskStore.updateTask(taskId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        durationMs: endTime - startTime,
        result,
      });

      if (task.webhookUrl && updatedTask) {
        await sendWebhookNotification(task.webhookUrl, updatedTask);
      }
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : "Task execution failed";
      const updatedTask = taskStore.updateTask(taskId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        durationMs: endTime - startTime,
        error: errorMessage,
      });

      if (task.webhookUrl && updatedTask) {
        await sendWebhookNotification(task.webhookUrl, updatedTask);
      }
    }
  });
}
