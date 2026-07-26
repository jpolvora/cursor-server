import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { createTaskRoutes } from "./tasks.js";
import { taskStore } from "../services/task-store.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Task stream routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-stream-"));
  const config: Config = {
    CURSOR_API_KEY: "cursor-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-stream",
    SCHEDULED_REVIEW_JOBS: false,
    TENANTS: [
      { id: "tenant-a", apiKey: "fake-a", allowedRepos: [] },
      { id: "tenant-b", apiKey: "fake-b", allowedRepos: [] },
    ],
  };

  const app = new Hono();
  app.use("/tasks", authMiddleware(config));
  app.use("/tasks/*", authMiddleware(config));
  app.route("/tasks", createTaskRoutes(config));

  taskStore.init(reposRoot);

  it("accepts stream auth via apiKey query param", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "probe",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "completed" });

    const res = await app.request(`/tasks/${task.id}/stream?apiKey=fake-stream`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
    const body = await res.text();
    assert.match(body, /event: status/);
    assert.match(body, /event: done/);
  });

  it("delivers output events while task is running", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "stream-output",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "running" });

    const streamPromise = app.request(`/tasks/${task.id}/stream`, {
      headers: { "X-API-Key": "fake-stream" },
    });

    await sleep(50);
    taskStore.emitOutput(task.id, "agent progress line\n");
    await sleep(50);
    taskStore.updateTask(task.id, { status: "completed" });

    const res = await streamPromise;
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.match(body, /event: output/);
    assert.match(body, /agent progress line/);
    assert.match(body, /event: done/);
  });

  it("denies cross-tenant stream access", async () => {
    const task = taskStore.createTask({
      tenantId: "tenant-b",
      prompt: "private",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });

    const res = await app.request(`/tasks/${task.id}/stream`, {
      headers: { "X-API-Key": "fake-a" },
    });
    assert.strictEqual(res.status, 404);
  });
});
