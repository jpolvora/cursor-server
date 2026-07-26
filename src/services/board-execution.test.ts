import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { boardDb } from "../services/board-db.js";
import { createBoardRoutes } from "../routes/board.js";
import { authMiddleware } from "../middleware/auth.js";
import { taskStore } from "../services/task-store.js";
import {
  finishCard,
  getCardStatus,
  pauseCard,
  resumeCard,
  syncCardFromTask,
} from "../services/board-execution.js";
import { cancelTask, setSkipBackgroundProcessingForTest } from "../services/task-worker.js";

describe("Board execution control", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "board-exec-"));
  const dbPath = path.join(os.tmpdir(), `board-exec-${Date.now()}.db`);
  const secretsDir = fs.mkdtempSync(path.join(os.tmpdir(), "board-exec-secrets-"));

  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    BOARD_DB_PATH: dbPath,
    SECRETS_DIR: secretsDir,
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-exec-key",
    TENANTS: [],
  };

  const app = new Hono();
  app.use("/board/*", authMiddleware(config));
  app.route("/board", createBoardRoutes(config));

  const authHeaders = { "X-API-Key": "fake-exec-key", "Content-Type": "application/json" };

  const sampleSpec = `---
slug: exec-test-spec
title: Exec Test Spec
version: 1.0.0
---
# Exec Test Spec

## Description
Execution control test spec.

## Acceptance Criteria

### AC1: Works
- **Given** a card
- **When** started
- **Then** task is enqueued
`;

  let repoId = 0;
  let cardId = 0;

  before(async () => {
    setSkipBackgroundProcessingForTest(true);
    await boardDb.init(dbPath);
    taskStore.init(reposRoot);
    process.env.BOARD_EXEC_TEST_TOKEN = "fake-token";

    const repo = boardDb.createRepo({
      name: "exec-repo",
      remote_url: "https://github.com/example/exec.git",
      secret_ref: "BOARD_EXEC_TEST_TOKEN",
    });
    repoId = repo.id;

    const clonePath = path.join(reposRoot, repo.name);
    fs.mkdirSync(path.join(clonePath, ".agents", "specs"), { recursive: true });

    const card = boardDb.createCard({
      repo_id: repoId,
      title: "Exec Test Spec",
      spec_markdown: sampleSpec,
      lane: "ready",
    });
    cardId = card.id;
  });

  after(() => {
    setSkipBackgroundProcessingForTest(false);
    boardDb.close();
    delete process.env.BOARD_EXEC_TEST_TOKEN;
    try {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(reposRoot, { recursive: true, force: true });
      fs.rmSync(secretsDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("start requires confirm and enqueues task with active_run_id", async () => {
    const noConfirm = await app.request(`/board/cards/${cardId}/start`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ workflow: "full" }),
    });
    assert.strictEqual(noConfirm.status, 400);

    const startRes = await app.request(`/board/cards/${cardId}/start`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ workflow: "full", confirm: true, flags: ["auto"] }),
    });
    assert.strictEqual(startRes.status, 202);
    const started = (await startRes.json()) as { card: { active_run_id: string; lane: string }; taskId: string };
    assert.ok(started.card.active_run_id);
    assert.strictEqual(started.card.lane, "implementing");
    assert.strictEqual(started.taskId, started.card.active_run_id);

    const task = taskStore.getTask(started.taskId);
    assert.ok(task);
    assert.strictEqual(task!.agent, "spec-to-pr");
    assert.match(task!.prompt, /\/ws-spec-to-pr auto \.agents\/specs\//);

    cancelTask(started.taskId);
    boardDb.updateCard(cardId, { active_run_id: null, lane: "ready" });
  });

  it("start returns 409 when run already active", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "probe",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    boardDb.updateCard(cardId, { active_run_id: task.id, lane: "implementing" });

    const res = await app.request(`/board/cards/${cardId}/start`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ workflow: "full", confirm: true }),
    });
    assert.strictEqual(res.status, 409);

    boardDb.updateCard(cardId, { active_run_id: null, lane: "ready" });
  });

  it("pause keeps active_run_id and sets lane paused", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "pause-test",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "running" });
    boardDb.updateCard(cardId, { active_run_id: task.id, lane: "implementing", workflow: "full" });

    const result = pauseCard(cardId);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.card.lane, "paused");
      assert.strictEqual(result.card.active_run_id, task.id);
    }

    const stored = taskStore.getTask(task.id);
    assert.strictEqual(stored?.status, "cancelled");
  });

  it("resume requeues paused run without new active_run_id", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "resume-test",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr-lite",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "cancelled" });
    boardDb.updateCard(cardId, {
      active_run_id: task.id,
      lane: "paused",
      workflow: "lite",
    });

    const result = resumeCard(config, cardId);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.card.active_run_id, task.id);
      assert.strictEqual(result.card.lane, "implementing");
    }

    cancelTask(task.id);
  });

  it("finish clears active_run_id and moves to done", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "finish-test",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "running" });
    boardDb.updateCard(cardId, { active_run_id: task.id, lane: "review" });

    const noConfirm = finishCard(cardId, {});
    assert.strictEqual(noConfirm.ok, false);
    if (!noConfirm.ok) assert.strictEqual(noConfirm.status, 400);

    const result = finishCard(cardId, { confirm: true });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.card.lane, "done");
      assert.strictEqual(result.card.active_run_id, null);
    }
  });

  it("status endpoint returns card and run summary", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "status-test",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "running", startedAt: new Date().toISOString() });
    boardDb.updateCard(cardId, {
      active_run_id: task.id,
      lane: "implementing",
      step_label: "step-04",
      workflow: "full",
    });

    const res = await app.request(`/board/cards/${cardId}/status`, { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      card: { id: number };
      run: { id: string; status: string; step_label: string };
    };
    assert.strictEqual(body.card.id, cardId);
    assert.strictEqual(body.run.id, task.id);
    assert.strictEqual(body.run.status, "running");
    assert.strictEqual(body.run.step_label, "step-04");

    const direct = getCardStatus(cardId);
    assert.strictEqual(direct.ok, true);
  });

  it("sync maps failed runs to blocked lane", () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "sync-fail",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    boardDb.updateCard(cardId, {
      active_run_id: task.id,
      lane: "implementing",
      workflow: "full",
    });
    taskStore.updateTask(task.id, { status: "failed", error: "agent error" });

    syncCardFromTask(task.id);
    const card = boardDb.getCard(cardId);
    assert.strictEqual(card?.lane, "blocked");
  });

  it("move rejects when active_run_id is set", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "move-lock",
      repo: "exec-repo",
      repoPath: path.join(reposRoot, "exec-repo"),
      agent: "spec-to-pr",
      model: "composer-2",
    });
    boardDb.updateCard(cardId, { active_run_id: task.id, lane: "implementing" });

    const moveRes = await app.request(`/board/cards/${cardId}/move`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ lane: "ready" }),
    });
    assert.strictEqual(moveRes.status, 409);

    boardDb.updateCard(cardId, { active_run_id: null, lane: "ready" });
  });
});
