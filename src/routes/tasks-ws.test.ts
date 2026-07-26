import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { authMiddleware } from "../middleware/auth.js";
import { createTaskRoutes } from "./tasks.js";
import { taskStore } from "../services/task-store.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openWebSocket(url: string, options?: { headers?: Record<string, string> }): Promise<{
  ws: WebSocket;
  messages: string[];
}> {
  return new Promise((resolve, reject) => {
    const messages: string[] = [];
    const ws = options?.headers
      ? new WebSocket(url, { headers: options.headers })
      : new WebSocket(url);

    ws.on("message", (data) => {
      messages.push(data.toString());
    });

    ws.once("open", () => resolve({ ws, messages }));
    ws.once("error", reject);
  });
}

function waitForMessages(messages: string[], count: number, timeoutMs = 3000): Promise<string[]> {
  if (messages.length >= count) {
    return Promise.resolve(messages.slice(0, count));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${count} WebSocket messages (got ${messages.length})`));
    }, timeoutMs);

    const check = () => {
      if (messages.length >= count) {
        clearTimeout(timer);
        resolve(messages.slice(0, count));
      }
    };

    const interval = setInterval(() => {
      check();
      if (messages.length >= count) {
        clearInterval(interval);
      }
    }, 10);

    setTimeout(() => clearInterval(interval), timeoutMs);
  });
}

describe("Task WebSocket stream routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-ws-"));
  const config: Config = {
    CURSOR_API_KEY: "cursor-key",
    PORT: 0,
    HOST: "127.0.0.1",
    REPOS_ROOT: reposRoot,
    BOARD_DB_PATH: "./data/test-board.db",
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-ws-stream",
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

  const wss = new WebSocketServer({ noServer: true });
  let server: ServerType;
  let wsBaseUrl: string;

  before(async () => {
    taskStore.init(reposRoot);
    server = serve({
      fetch: app.fetch,
      port: 0,
      hostname: "127.0.0.1",
      websocket: { server: wss },
    });
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("Expected server to listen on a TCP port");
    }
    wsBaseUrl = `ws://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server.close();
    wss.close();
  });

  it("accepts WebSocket auth via apiKey query param", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "ws-probe",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "completed" });

    const { ws, messages } = await openWebSocket(
      `${wsBaseUrl}/tasks/${encodeURIComponent(task.id)}/ws?apiKey=fake-ws-stream`,
    );
    await waitForMessages(messages, 2);
    ws.close();

    const parsed = messages.map((m) => JSON.parse(m) as { event: string; data: unknown });
    assert.deepStrictEqual(parsed[0]?.event, "status");
    assert.deepStrictEqual(parsed[1]?.event, "done");
  });

  it("delivers output events while task is running", async () => {
    const task = taskStore.createTask({
      tenantId: "master",
      prompt: "ws-output",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });
    taskStore.updateTask(task.id, { status: "running" });

    const { ws, messages } = await openWebSocket(
      `${wsBaseUrl}/tasks/${encodeURIComponent(task.id)}/ws`,
      { headers: { "X-API-Key": "fake-ws-stream" } },
    );
    await waitForMessages(messages, 1);
    taskStore.emitOutput(task.id, "websocket progress line\n");
    await sleep(50);
    taskStore.updateTask(task.id, { status: "completed" });
    await waitForMessages(messages, 3);
    ws.close();

    const body = messages.join("\n");
    assert.match(body, /"event":"output"/);
    assert.match(body, /websocket progress line/);
    assert.match(body, /"event":"done"/);
  });

  it("rejects cross-tenant WebSocket access", async () => {
    const task = taskStore.createTask({
      tenantId: "tenant-b",
      prompt: "private-ws",
      repo: "probe-repo",
      repoPath: reposRoot,
      agent: "default",
      model: "composer-2",
    });

    const ws = new WebSocket(`${wsBaseUrl}/tasks/${encodeURIComponent(task.id)}/ws`, {
      headers: { "X-API-Key": "fake-a" },
    });

    await new Promise<void>((resolve) => {
      ws.once("close", () => resolve());
      ws.once("error", () => resolve());
      setTimeout(resolve, 1000);
    });

    assert.notEqual(ws.readyState, WebSocket.OPEN);
  });
});
