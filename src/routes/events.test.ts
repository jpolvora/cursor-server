import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { taskStore } from "../services/task-store.js";
import { createEventRoutes, DEFAULT_EVENT_TYPE } from "./events.js";

describe("Event API Routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "events-route-"));
  const repoName = "events-repo";
  const repoPath = path.join(reposRoot, repoName);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.mkdirSync(path.join(repoPath, ".git"));

  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    CURSOR_MODEL: "composer-2",
    SCHEDULED_REVIEW_JOBS: false,
    TENANTS: [],
  };

  const app = new Hono();
  app.use("/events", authMiddleware(config));
  app.route("/events", createEventRoutes(config));

  const basePayload = {
    prompt: "Run a quick check",
    repo: repoName,
  };

  it("POST /events defaults event to task when omitted", async () => {
    const res = await app.request("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify(basePayload),
    });

    assert.strictEqual(res.status, 202);
    const json = (await res.json()) as {
      taskId: string;
      status: string;
      event: string;
      agent: string;
    };
    assert.strictEqual(json.event, DEFAULT_EVENT_TYPE);
    assert.strictEqual(json.agent, "default");
    assert.strictEqual(json.status, "queued");

    const task = taskStore.getTask(json.taskId);
    assert.ok(task);
    assert.strictEqual(task.agent, "default");
  });

  it("POST /events preserves explicit event type", async () => {
    const res = await app.request("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ ...basePayload, event: "deploy.completed" }),
    });

    assert.strictEqual(res.status, 202);
    const json = (await res.json()) as { event: string };
    assert.strictEqual(json.event, "deploy.completed");
  });

  it("POST /events stores webhookUrl for background delivery", async () => {
    const webhookUrl = "https://example.com/hooks/cursor";
    const res = await app.request("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ ...basePayload, webhookUrl }),
    });

    assert.strictEqual(res.status, 202);
    const json = (await res.json()) as { taskId: string };
    const task = taskStore.getTask(json.taskId);
    assert.ok(task);
    assert.strictEqual(task.webhookUrl, webhookUrl);
  });

  it("POST /events rejects empty event string", async () => {
    const res = await app.request("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ ...basePayload, event: "" }),
    });

    assert.strictEqual(res.status, 400);
  });
});
