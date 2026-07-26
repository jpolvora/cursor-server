import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { boardDb } from "./board-db.js";
import { isCloneMissingOrEmpty, cleanupClone } from "./board-clone.js";
import { sanitizeCloneError } from "./board-secret.js";

describe("board-db", () => {
  const dbPath = path.join(os.tmpdir(), `board-db-unit-${Date.now()}.db`);

  before(async () => {
    await boardDb.init(dbPath);
  });

  after(() => {
    boardDb.close();
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // ignore
    }
  });

  it("creates and lists repos and cards", () => {
    const repo = boardDb.createRepo({
      name: "unit-repo",
      remote_url: "https://github.com/example/unit.git",
      secret_ref: "TOKEN_ENV",
    });
    assert.strictEqual(repo.name, "unit-repo");

    const card = boardDb.createCard({
      repo_id: repo.id,
      title: "Unit Card",
      spec_markdown: "# Test\n\n## Description\nx\n\n## Acceptance Criteria\n\n### AC1: T\n- **Given** a\n- **When** b\n- **Then** c",
    });
    assert.strictEqual(card.lane, "backlog");

    const cards = boardDb.listCards({ repoId: repo.id, lane: "backlog" });
    assert.strictEqual(cards.length, 1);
  });

  it("seeds default settings keys on init", () => {
    const settings = boardDb.listSettings();
    assert.strictEqual(settings.default_agent, "default");
    assert.strictEqual(settings.default_harness_runner, "cursor-local");
    assert.strictEqual(settings.ui_theme, "dark");
    assert.strictEqual(settings.ui_density, "comfortable");
    assert.strictEqual(settings.board_default_lane, "backlog");
    assert.strictEqual(boardDb.getSetting("ui_theme"), "dark");
  });

  it("persists settings across reopen", async () => {
    boardDb.setSettings({ ui_theme: "light" });
    assert.strictEqual(boardDb.listSettings().ui_theme, "light");

    boardDb.close();
    await boardDb.init(dbPath);

    assert.strictEqual(boardDb.listSettings().ui_theme, "light");
    assert.strictEqual(boardDb.getSetting("ui_theme"), "light");
    assert.strictEqual(boardDb.listSettings().default_agent, "default");
  });
});

describe("board-clone helpers", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "board-clone-"));

  it("detects missing or empty clone directories", () => {
    const missing = path.join(tmpDir, "missing");
    assert.strictEqual(isCloneMissingOrEmpty(missing), true);

    const empty = path.join(tmpDir, "empty");
    fs.mkdirSync(empty, { recursive: true });
    assert.strictEqual(isCloneMissingOrEmpty(empty), true);
  });

  it("cleanup removes directory", () => {
    const target = path.join(tmpDir, "cleanup-me");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "file.txt"), "x");
    const result = cleanupClone(target);
    assert.strictEqual(result.ok, true);
    assert.ok(!fs.existsSync(target));
  });
});

describe("board-secret", () => {
  it("sanitizes credentials from error messages", () => {
    const raw = "fatal: https://x-access-token:ghp_secret123@github.com/foo.git";
    const sanitized = sanitizeCloneError(raw);
    assert.ok(!sanitized.includes("ghp_secret123"));
    assert.ok(sanitized.includes("***"));
  });
});
