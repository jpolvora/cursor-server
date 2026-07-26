import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { boardDb } from "../services/board-db.js";
import { createUiRoutes } from "./ui.js";
import { renderDashboardPageHtml } from "./dashboard-page.js";
import { createSettingsRoutes } from "./settings.js";
import { authMiddleware } from "../middleware/auth.js";
import { healthRoutes } from "./health.js";

describe("Dashboard root UI", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-route-"));
  const dbPath = path.join(os.tmpdir(), `dashboard-test-${Date.now()}.db`);

  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    BOARD_DB_PATH: dbPath,
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-board-key",
    TENANTS: [],
    SCHEDULED_REVIEW_JOBS: false,
  };

  const app = new Hono();
  app.route("/", healthRoutes);
  app.get("/", (c) => c.html(renderDashboardPageHtml()));
  app.route("/ui", createUiRoutes());
  app.use("/settings", authMiddleware(config));
  app.use("/settings/*", authMiddleware(config));
  app.route("/settings", createSettingsRoutes(config));

  before(async () => {
    await boardDb.init(dbPath);
  });

  after(() => {
    boardDb.close();
    try {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(reposRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("GET / returns HTML shell with login", async () => {
    const res = await app.request("/");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));
    const body = await res.text();
    assert.ok(body.includes("login-gate") || body.includes("login-api-key"));
    assert.ok(body.includes("cursor-server"));
    assert.ok(body.includes('id="login-api-key"') || body.includes("API key"));
  });

  it("HTML includes nav, panes, KEY_STORAGE, and Kanban link", async () => {
    const res = await app.request("/");
    const body = await res.text();
    assert.ok(body.includes("Dashboard"));
    assert.ok(body.includes("Kanban board"));
    assert.ok(body.includes("Projects"));
    assert.ok(body.includes("Configuration"));
    assert.ok(body.includes('id="main-pane"'));
    assert.ok(body.includes("cursor-server-api-key"));
    assert.ok(body.includes("/ui/board"));
    assert.ok(body.includes("#login-error") || body.includes('id="login-error"'));
    assert.ok(body.includes("btn-logout") || body.includes("Log out"));
    assert.ok(body.includes("39-board-projects-management"));
    assert.ok(body.includes("--accent"));
    assert.ok(body.includes("#3d8bfd"));
    assert.ok(!body.toLowerCase().includes("purple-gradient"));
    assert.ok(body.includes("/ui/prompt"));
    assert.ok(body.includes("/ui/spec-editor"));
    assert.ok(body.includes("data-view") || body.includes("#dashboard"));
  });

  it("GET /health still works", async () => {
    const res = await app.request("/health");
    assert.strictEqual(res.status, 200);
  });

  it("GET /ui/board still returns 200", async () => {
    const res = await app.request("/ui/board");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));
  });
});
