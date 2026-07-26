import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { createHarnessRoutes } from "./harness.js";
import { createTaskRoutes } from "./tasks.js";
import { stageStore } from "../services/stage-store.js";
import { taskStore } from "../services/task-store.js";

function withTenantContext(tenantId: string, allowedRepos: string[]) {
  return async (c: { set: (key: "tenantId" | "allowedRepos", value: string | string[]) => void }, next: () => Promise<void>) => {
    c.set("tenantId", tenantId);
    c.set("allowedRepos", allowedRepos);
    await next();
  };
}

describe("tenant isolation routes", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-iso-"));
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-repos-"));
  const allowedRepo = path.join(reposRoot, "allowed-repo");
  const deniedRepo = path.join(reposRoot, "denied-repo");
  fs.mkdirSync(allowedRepo, { recursive: true });
  fs.mkdirSync(deniedRepo, { recursive: true });
  fs.mkdirSync(path.join(allowedRepo, ".git"));
  fs.mkdirSync(path.join(deniedRepo, ".git"));

  stageStore.init(tmpDir);
  taskStore.init(tmpDir);

  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    BOARD_DB_PATH: "./data/test-board.db",
    CURSOR_MODEL: "composer-2",
    TENANTS: [],
  };

  const sampleSpec = `---
id: tenant-iso-spec
title: Tenant ISO Spec
stages: ["spec", "implement"]
---
# Tenant ISO Spec
## Description
Tenant isolation route test.
`;

  const harnessApp = new Hono();
  harnessApp.use("*", withTenantContext("tenant-a", ["allowed-repo"]));
  harnessApp.route("/harness", createHarnessRoutes(config));

  const tasksApp = new Hono();
  tasksApp.use("*", withTenantContext("tenant-a", ["allowed-repo"]));
  tasksApp.route("/tasks", createTaskRoutes(config));

  it("POST /harness/runs returns 403 for repo outside tenant allowlist", async () => {
    const res = await harnessApp.request("/harness/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: sampleSpec, repo: "denied-repo" }),
    });

    assert.strictEqual(res.status, 403);
    const json = (await res.json()) as { error: string };
    assert.match(json.error, /denied-repo/);
  });

  it("GET /harness/runs/:runId returns 404 for cross-tenant run", async () => {
    const run = stageStore.createRun({
      tenantId: "tenant-b",
      spec: {
        id: "cross-tenant-spec",
        title: "Cross Tenant",
        version: "1.0.0",
        description: "Owned by tenant-b",
        stages: ["spec"],
        acceptanceCriteria: [],
        dependencies: [],
      },
      repoPath: tmpDir,
    });

    const res = await harnessApp.request(`/harness/runs/${run.id}`);
    assert.strictEqual(res.status, 404);
  });

  it("GET /tasks/:id returns 404 for cross-tenant task", async () => {
    const task = taskStore.createTask({
      tenantId: "tenant-b",
      prompt: "secret",
      repo: "allowed-repo",
      repoPath: allowedRepo,
      agent: "default",
      model: "composer-2",
    });

    const res = await tasksApp.request(`/tasks/${task.id}`);
    assert.strictEqual(res.status, 404);
  });

  it("GET /tasks/:id/stream returns 404 for cross-tenant task", async () => {
    const task = taskStore.createTask({
      tenantId: "tenant-b",
      prompt: "secret",
      repo: "allowed-repo",
      repoPath: allowedRepo,
      agent: "default",
      model: "composer-2",
    });

    const res = await tasksApp.request(`/tasks/${task.id}/stream`);
    assert.strictEqual(res.status, 404);
  });
});
