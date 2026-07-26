import type { TaskRecord } from "./task-store.js";
import { taskStore } from "./task-store.js";

export type TaskStreamMessage =
  | {
      event: "status";
      data: { id: string; status: string; result?: unknown; error?: string };
    }
  | { event: "output"; data: { id: string; chunk: string } }
  | { event: "done"; data: { id: string; status: string } };

export function formatStatusMessage(
  task: Pick<TaskRecord, "id" | "status" | "result" | "error">,
): TaskStreamMessage {
  return {
    event: "status",
    data: { id: task.id, status: task.status, result: task.result, error: task.error },
  };
}

export function isTerminalTaskStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

/** Subscribe to task store events; returns cleanup. Sends initial status (+ done if terminal). */
export function attachTaskStream(
  taskId: string,
  task: TaskRecord,
  send: (message: TaskStreamMessage) => void | Promise<void>,
): () => void {
  void send(formatStatusMessage(task));

  if (isTerminalTaskStatus(task.status)) {
    void send({ event: "done", data: { id: task.id, status: task.status } });
    return () => {};
  }

  const onStatus = async (data: { id: string; status: string; record: TaskRecord }) => {
    if (data.id !== taskId) return;
    try {
      await send({
        event: "status",
        data: {
          id: data.id,
          status: data.status,
          result: data.record.result,
          error: data.record.error,
        },
      });
      if (isTerminalTaskStatus(data.status)) {
        await send({ event: "done", data: { id: data.id, status: data.status } });
        cleanup();
      }
    } catch {
      cleanup();
    }
  };

  const onOutput = async (data: { id: string; chunk: string }) => {
    if (data.id !== taskId) return;
    try {
      await send({ event: "output", data: { id: data.id, chunk: data.chunk } });
    } catch {
      cleanup();
    }
  };

  const cleanup = () => {
    taskStore.events.off("task:status", onStatus);
    taskStore.events.off("task:output", onOutput);
  };

  taskStore.events.on("task:status", onStatus);
  taskStore.events.on("task:output", onOutput);

  return cleanup;
}
