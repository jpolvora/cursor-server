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
    assert.ok(body.includes("#login-error") || body.includes('id="login-error"'));
    assert.ok(body.includes("btn-logout") || body.includes("Log out"));
  });

  it("shell nav links every view into the main container", async () => {
    const res = await app.request("/");
    const body = await res.text();
    assert.ok(body.includes("Dashboard"));
    assert.ok(body.includes("Kanban board"));
    assert.ok(body.includes("Projects"));
    assert.ok(body.includes("Configuration"));
    assert.ok(body.includes('id="main-pane"'));
    assert.ok(body.includes("/ui/board"));
    assert.ok(body.includes("/ui/prompt"));
    assert.ok(body.includes("/ui/spec-editor"));
    assert.ok(body.includes("/ui/projects"));
    assert.ok(body.includes("/ui/config"));
    assert.ok(body.includes("data-nav"));
    assert.ok(!body.includes("39-board-projects-management"));
    assert.ok(!body.includes("lands-in-39"));
  });

  it("marks exactly one nav entry as current per route", async () => {
    const cases: Array<[string, string]> = [
      ["/", "dashboard"],
      ["/ui/board", "board"],
      ["/ui/prompt", "prompt"],
      ["/ui/spec-editor", "specs"],
      ["/ui/projects", "projects"],
      ["/ui/config", "config"],
    ];
    for (const [route, viewId] of cases) {
      const body = await (await app.request(route)).text();
      const current = body.match(/aria-current="page"/g) || [];
      assert.strictEqual(current.length, 1, `${route} should mark one nav entry`);
      assert.ok(
        body.includes(`data-nav="${viewId}" aria-current="page"`),
        `${route} should mark ${viewId} as current`,
      );
    }
  });

  it("serves shared stylesheet and shell script instead of per-page style blocks", async () => {
    const css = await app.request("/ui/app.css");
    assert.strictEqual(css.status, 200);
    assert.ok((css.headers.get("content-type") || "").includes("text/css"));
    const cssBody = await css.text();
    assert.ok(cssBody.includes("--accent"));
    assert.ok(cssBody.includes("#3d8bfd"));
    assert.ok(cssBody.includes("--nav-w"));
    assert.ok(cssBody.includes("--mono"));

    const js = await app.request("/ui/app.js");
    assert.strictEqual(js.status, 200);
    assert.ok((js.headers.get("content-type") || "").includes("javascript"));
    const jsBody = await js.text();
    assert.ok(jsBody.includes("cursor-server-api-key"));
    assert.ok(jsBody.includes("cursorServerAuth"));
    assert.ok(jsBody.includes("/settings"));
  });

  it("keeps the shipped UI free of AI-slop chrome", async () => {
    const cssBody = await (await app.request("/ui/app.css")).text();
    assert.ok(!cssBody.includes("linear-gradient"));
    assert.ok(!cssBody.includes("radial-gradient"));
    assert.ok(!cssBody.toLowerCase().includes("purple"));

    const body = await (await app.request("/")).text();
    assert.ok(!body.toLowerCase().includes("purple-gradient"));
  });

  it("Projects view exposes CRUD affordances", async () => {
    const res = await app.request("/ui/projects");
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('id="btn-project-new"'));
    assert.ok(body.includes('id="project-modal"'));
    assert.ok(body.includes('id="project-delete-modal"'));
    assert.ok(body.includes("/ui/projects-client.js"));

    const client = await app.request("/ui/projects-client.js");
    assert.strictEqual(client.status, 200);
    const clientBody = await client.text();
    assert.ok(clientBody.includes("/board/repos"));
    assert.ok(clientBody.includes("DELETE"));
  });

  it("Configuration view ships the documented default option keys", async () => {
    const res = await app.request("/ui/config");
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    for (const key of [
      "default_agent",
      "default_harness_runner",
      "ui_theme",
      "ui_density",
      "board_default_lane",
    ]) {
      assert.ok(body.includes(`cfg-${key}`), `config view should expose ${key}`);
    }
    assert.ok(body.includes("/ui/config-client.js"));

    const client = await app.request("/ui/config-client.js");
    assert.strictEqual(client.status, 200);
    const clientBody = await client.text();
    assert.ok(clientBody.includes("/settings"));
    assert.ok(clientBody.includes("data-density"));
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
