import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { boardDb } from "../services/board-db.js";
import { createBoardRoutes } from "./board.js";
import { authMiddleware } from "../middleware/auth.js";
import { resolveSecretRef } from "../services/board-secret.js";

describe("Board API Routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "board-route-"));
  const dbPath = path.join(os.tmpdir(), `board-test-${Date.now()}.db`);
  const secretsDir = fs.mkdtempSync(path.join(os.tmpdir(), "board-secrets-"));

  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    BOARD_DB_PATH: dbPath,
    SECRETS_DIR: secretsDir,
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-board-key",
    TENANTS: [],
    SCHEDULED_REVIEW_JOBS: false,
  };

  const app = new Hono();
  app.use("/board/*", authMiddleware(config));
  app.route("/board", createBoardRoutes(config));

  const authHeaders = { "X-API-Key": "fake-board-key", "Content-Type": "application/json" };

  const sampleSpec = `---
slug: board-test-spec
title: Board Test Spec
version: 1.0.0
---
# Board Test Spec

## Description
Test spec for board import/export.

## Acceptance Criteria

### AC1: Works
- **Given** a valid spec
- **When** imported
- **Then** card is created
`;

  before(async () => {
    await boardDb.init(dbPath);
    process.env.BOARD_TEST_TOKEN = "fake-token-for-tests";
    fs.writeFileSync(path.join(secretsDir, "file-secret"), "file-token-value");
  });

  after(() => {
    boardDb.close();
    delete process.env.BOARD_TEST_TOKEN;
    try {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(reposRoot, { recursive: true, force: true });
      fs.rmSync(secretsDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("requires authentication", async () => {
    const res = await app.request("/board/repos");
    assert.strictEqual(res.status, 401);
  });

  it("CRUD repos without exposing secrets", async () => {
    const createRes = await app.request("/board/repos", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "test-repo",
        remote_url: "https://github.com/example/repo.git",
        secret_ref: "BOARD_TEST_TOKEN",
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = (await createRes.json()) as { repo: { id: number; secret_ref: string } };
    assert.strictEqual(created.repo.secret_ref, "BOARD_TEST_TOKEN");
    assert.ok(!JSON.stringify(created).includes("fake-token"));

    const listRes = await app.request("/board/repos", { headers: authHeaders });
    const list = (await listRes.json()) as { repos: Array<{ name: string }> };
    assert.strictEqual(list.repos.length, 1);
    assert.strictEqual(list.repos[0].name, "test-repo");

    const updateRes = await app.request(`/board/repos/${created.repo.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ remote_url: "https://github.com/example/repo-v2.git" }),
    });
    assert.strictEqual(updateRes.status, 200);
  });

  it("returns 400 for unresolved secret_ref on ensure-clone", async () => {
    const createRes = await app.request("/board/repos", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "no-secret-repo",
        remote_url: "https://github.com/example/nosecret.git",
        secret_ref: "MISSING_SECRET_REF_XYZ",
      }),
    });
    const created = (await createRes.json()) as { repo: { id: number } };

    const ensureRes = await app.request(`/board/repos/${created.repo.id}/ensure-clone`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.strictEqual(ensureRes.status, 400);
    const body = (await ensureRes.json()) as { error: string };
    assert.ok(body.error.includes("Unable to resolve secret_ref"));
    assert.ok(!body.error.includes("token"));
  });

  it("resolves secret_ref from file", () => {
    const result = resolveSecretRef("file-secret", secretsDir);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value, "file-token-value");
    }
  });

  it("CRUD cards with lane filter and default backlog", async () => {
    const reposRes = await app.request("/board/repos", { headers: authHeaders });
    const repos = (await reposRes.json()) as { repos: Array<{ id: number }> };
    const repoId = repos.repos[0].id;

    const createRes = await app.request("/board/cards", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        repo_id: repoId,
        title: "My Card",
        spec_markdown: sampleSpec,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = (await createRes.json()) as { card: { id: number; lane: string } };
    assert.strictEqual(created.card.lane, "backlog");

    const filterRes = await app.request(`/board/cards?repoId=${repoId}&lane=backlog`, {
      headers: authHeaders,
    });
    const filtered = (await filterRes.json()) as { cards: Array<{ id: number }> };
    assert.ok(filtered.cards.some((c) => c.id === created.card.id));

    const updateRes = await app.request(`/board/cards/${created.card.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ title: "Updated Card" }),
    });
    assert.strictEqual(updateRes.status, 200);
  });

  it("move rejects when active_run_id is set", async () => {
    const reposRes = await app.request("/board/repos", { headers: authHeaders });
    const repos = (await reposRes.json()) as { repos: Array<{ id: number }> };
    const repoId = repos.repos[0].id;

    const createRes = await app.request("/board/cards", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        repo_id: repoId,
        title: "Running Card",
        spec_markdown: sampleSpec,
        active_run_id: "run-123",
      }),
    });
    const created = (await createRes.json()) as { card: { id: number } };

    const moveRes = await app.request(`/board/cards/${created.card.id}/move`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ lane: "ready" }),
    });
    assert.strictEqual(moveRes.status, 409);
  });

  it("move allows planning lane changes when no active run", async () => {
    const reposRes = await app.request("/board/repos", { headers: authHeaders });
    const repos = (await reposRes.json()) as { repos: Array<{ id: number }> };
    const repoId = repos.repos[0].id;

    const createRes = await app.request("/board/cards", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        repo_id: repoId,
        title: "Movable Card",
        spec_markdown: sampleSpec,
      }),
    });
    const created = (await createRes.json()) as { card: { id: number } };

    const moveRes = await app.request(`/board/cards/${created.card.id}/move`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ lane: "ready" }),
    });
    assert.strictEqual(moveRes.status, 200);
    const moved = (await moveRes.json()) as { card: { lane: string } };
    assert.strictEqual(moved.card.lane, "ready");
  });

  it("import and export specs from clone directory", async () => {
    const reposRes = await app.request("/board/repos", { headers: authHeaders });
    const repos = (await reposRes.json()) as { repos: Array<{ id: number; name: string }> };
    const repo = repos.repos[0];

    const clonePath = path.join(reposRoot, repo.name);
    fs.mkdirSync(path.join(clonePath, ".agents", "specs"), { recursive: true });
    fs.writeFileSync(path.join(clonePath, ".agents", "specs", "imported.spec.md"), sampleSpec);

    const importRes = await app.request(`/board/repos/${repo.id}/import-specs`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.strictEqual(importRes.status, 200);
    const imported = (await importRes.json()) as { imported: Array<{ title: string }> };
    assert.ok(imported.imported.length >= 1);

    const cardsRes = await app.request(`/board/cards?repoId=${repo.id}`, { headers: authHeaders });
    const cards = (await cardsRes.json()) as { cards: Array<{ id: number; title: string }> };
    const card = cards.cards.find((c) => c.title === "Board Test Spec");
    assert.ok(card);

    const exportRes = await app.request(`/board/cards/${card!.id}/export-spec`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.strictEqual(exportRes.status, 200);
    const exported = (await exportRes.json()) as { filename: string };
    assert.ok(exported.filename.endsWith(".spec.md"));

    const exportedPath = path.join(clonePath, ".agents", "specs", exported.filename);
    assert.ok(fs.existsSync(exportedPath));
  });

  it("cleanup-clone removes working tree but keeps DB row", async () => {
    const reposRes = await app.request("/board/repos", { headers: authHeaders });
    const repos = (await reposRes.json()) as { repos: Array<{ id: number; name: string }> };
    const repo = repos.repos[0];
    const clonePath = path.join(reposRoot, repo.name);

    assert.ok(fs.existsSync(clonePath));

    const cleanupRes = await app.request(`/board/repos/${repo.id}/cleanup-clone`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.strictEqual(cleanupRes.status, 200);
    assert.ok(!fs.existsSync(clonePath));

    const getRes = await app.request(`/board/repos/${repo.id}`, { headers: authHeaders });
    assert.strictEqual(getRes.status, 200);
  });

  it("import returns 422 for invalid specs", async () => {
    const createRes = await app.request("/board/repos", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "invalid-spec-repo",
        remote_url: "https://github.com/example/invalid.git",
        secret_ref: "BOARD_TEST_TOKEN",
      }),
    });
    const created = (await createRes.json()) as { repo: { id: number; name: string } };

    const clonePath = path.join(reposRoot, created.repo.name);
    fs.mkdirSync(path.join(clonePath, ".agents", "specs"), { recursive: true });
    fs.writeFileSync(
      path.join(clonePath, ".agents", "specs", "bad.spec.md"),
      JSON.stringify({ title: 123 }),
    );

    const importRes = await app.request(`/board/repos/${created.repo.id}/import-specs`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.strictEqual(importRes.status, 422);
  });
});
