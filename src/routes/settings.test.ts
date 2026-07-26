import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { boardDb } from "../services/board-db.js";
import { authMiddleware } from "../middleware/auth.js";
import { createSettingsRoutes } from "./settings.js";

describe("Settings API Routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "settings-route-"));
  const dbPath = path.join(os.tmpdir(), `settings-test-${Date.now()}.db`);

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
  app.use("/settings", authMiddleware(config));
  app.use("/settings/*", authMiddleware(config));
  app.route("/settings", createSettingsRoutes(config));

  const authHeaders = { "X-API-Key": "fake-board-key", "Content-Type": "application/json" };

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

  it("rejects missing key when auth enabled", async () => {
    const res = await app.request("/settings");
    assert.strictEqual(res.status, 401);
  });

  it("GET returns seeded defaults with valid key", async () => {
    const res = await app.request("/settings", { headers: authHeaders });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { settings: Record<string, string> };
    assert.strictEqual(body.settings.default_agent, "default");
    assert.strictEqual(body.settings.default_harness_runner, "cursor-local");
    assert.strictEqual(body.settings.ui_theme, "dark");
    assert.strictEqual(body.settings.ui_density, "comfortable");
    assert.strictEqual(body.settings.board_default_lane, "backlog");
  });

  it("PUT updates value and GET reflects", async () => {
    const putRes = await app.request("/settings", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ settings: { ui_theme: "light", ui_density: "compact" } }),
    });
    assert.strictEqual(putRes.status, 200);
    const putBody = (await putRes.json()) as { settings: Record<string, string> };
    assert.strictEqual(putBody.settings.ui_theme, "light");
    assert.strictEqual(putBody.settings.ui_density, "compact");
    assert.strictEqual(putBody.settings.default_agent, "default");

    const getRes = await app.request("/settings", { headers: authHeaders });
    const getBody = (await getRes.json()) as { settings: Record<string, string> };
    assert.strictEqual(getBody.settings.ui_theme, "light");
    assert.strictEqual(getBody.settings.ui_density, "compact");
  });

  it("rejects unknown setting key with 400", async () => {
    const res = await app.request("/settings", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ settings: { secret_api_key: "nope" } }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error.includes("Unknown"));
  });

  it("rejects invalid enum value with 400", async () => {
    const res = await app.request("/settings", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ settings: { ui_theme: "neon" } }),
    });
    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error.includes("ui_theme"));
  });
});
