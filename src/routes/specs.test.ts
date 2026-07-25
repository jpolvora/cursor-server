import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import type { Config } from "../config.js";
import { createRepoSpecRoutes, createSpecRoutes } from "./specs.js";

describe("Spec API Routes", () => {
  const reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "specs-route-"));
  const repoName = "editor-repo";
  const repoPath = path.join(reposRoot, repoName);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.mkdirSync(path.join(repoPath, ".git"));

  const config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: reposRoot,
    CURSOR_MODEL: "composer-2",
  } satisfies Config;

  const app = new Hono();
  app.route("/specs", createSpecRoutes(config));
  app.route("/repos", createRepoSpecRoutes(config));

  const sampleSpec = `---
id: editor-test
title: Editor Test Spec
version: 1.0.0
---
# Editor Test Spec

## Description
Written via PUT route.

## Acceptance Criteria

### AC1: Saved
- **Given** content is valid
- **When** PUT succeeds
- **Then** file exists under .agents/specs
`;

  it("PUT writes spec file under .agents/specs", async () => {
    const res = await app.request(`/repos/${repoName}/specs/editor-test.spec.md`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sampleSpec }),
    });

    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as { ok: boolean; path: string };
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.path, ".agents/specs/editor-test.spec.md");

    const onDisk = path.join(repoPath, ".agents", "specs", "editor-test.spec.md");
    assert.ok(fs.existsSync(onDisk));
    assert.strictEqual(fs.readFileSync(onDisk, "utf-8"), sampleSpec);
  });

  it("GET reads written spec file", async () => {
    const res = await app.request(`/repos/${repoName}/specs/editor-test.spec.md`);
    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as { content: string; path: string };
    assert.strictEqual(json.path, ".agents/specs/editor-test.spec.md");
    assert.ok(json.content.includes("Editor Test Spec"));
  });

  it("PUT rejects traversal filenames", async () => {
    const file = encodeURIComponent("../escape.spec.md");
    const res = await app.request(`/repos/${repoName}/specs/${file}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sampleSpec }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("PUT rejects invalid content when requireValid", async () => {
    const res = await app.request(`/repos/${repoName}/specs/bad.spec.md`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify({ title: 123 }) }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("POST /specs/validate returns valid for markdown", async () => {
    const res = await app.request("/specs/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: sampleSpec }),
    });
    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as { valid: boolean };
    assert.strictEqual(json.valid, true);
  });
});
