import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STALE_TASK_RESTART_ERROR, TaskStore } from "./task-store.js";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../test/fixtures/stale-running.tasks.json"
);

function withTempTasksFile(
  callback: (reposRoot: string) => void
): void {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-store-test-"));
  try {
    fs.copyFileSync(fixturePath, path.join(reposRoot, ".tasks.json"));
    callback(reposRoot);
  } finally {
    fs.rmSync(reposRoot, { recursive: true, force: true });
  }
}

describe("task-store", () => {
  it("marks running and queued tasks as failed on load after restart", () => {
    withTempTasksFile((reposRoot) => {
      const store = new TaskStore();
      store.init(reposRoot);

      const running = store.getTask("task_running_stale");
      const queued = store.getTask("task_queued_stale");
      const completed = store.getTask("task_completed_ok");
      const failed = store.getTask("task_failed_ok");

      assert.ok(running);
      assert.strictEqual(running.status, "failed");
      assert.strictEqual(running.error, STALE_TASK_RESTART_ERROR);
      assert.ok(running.completedAt);

      assert.ok(queued);
      assert.strictEqual(queued.status, "failed");
      assert.strictEqual(queued.error, STALE_TASK_RESTART_ERROR);
      assert.ok(queued.completedAt);

      assert.ok(completed);
      assert.strictEqual(completed.status, "completed");
      assert.strictEqual(completed.completedAt, "2026-07-25T09:05:00.000Z");
      assert.strictEqual(completed.result?.run.result, "done");

      assert.ok(failed);
      assert.strictEqual(failed.status, "failed");
      assert.strictEqual(failed.error, "agent error");
      assert.strictEqual(failed.completedAt, "2026-07-25T08:01:00.000Z");

      const persisted = JSON.parse(
        fs.readFileSync(path.join(reposRoot, ".tasks.json"), "utf-8")
      ) as Array<{ id: string; status: string }>;
      assert.strictEqual(
        persisted.filter((task) => task.status === "running" || task.status === "queued").length,
        0
      );
    });
  });

  it("reconciliation is idempotent across reloads", () => {
    withTempTasksFile((reposRoot) => {
      const firstLoad = new TaskStore();
      firstLoad.init(reposRoot);

      const afterFirst = JSON.parse(
        fs.readFileSync(path.join(reposRoot, ".tasks.json"), "utf-8")
      );

      const secondLoad = new TaskStore();
      secondLoad.init(reposRoot);

      const afterSecond = JSON.parse(
        fs.readFileSync(path.join(reposRoot, ".tasks.json"), "utf-8")
      );

      assert.deepStrictEqual(afterSecond, afterFirst);

      const running = secondLoad.getTask("task_running_stale");
      assert.ok(running);
      assert.strictEqual(running.status, "failed");
      assert.strictEqual(running.error, STALE_TASK_RESTART_ERROR);
    });
  });
});
