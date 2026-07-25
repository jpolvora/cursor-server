import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { harnessRoutes } from "./harness.js";
import { stageStore } from "../services/stage-store.js";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

describe("Harness API Routes", () => {
  const app = new Hono();
  app.route("/harness", harnessRoutes);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-route-test-"));
  stageStore.init(tmpDir);

  const sampleSpec = `---
id: route-test-spec
title: Route Test Spec
stages: ["spec", "implement"]
---
# Route Test Spec
## Description
Spec for route tests.
`;

  it("GET /harness/runners lists registered runners", async () => {
    const res = await app.request("/harness/runners");
    assert.strictEqual(res.status, 200);

    const json = (await res.json()) as any;
    assert.ok(Array.isArray(json.runners));
    assert.strictEqual(json.defaultRunnerId, "cursor-local");
  });

  it("POST /harness/runs rejects invalid spec payload", async () => {
    const res = await app.request("/harness/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
    const json = (await res.json()) as any;
    assert.ok(json.error);
  });

  it("POST /harness/runs accepts valid spec and returns 202 Accepted (AC4)", async () => {
    const res = await app.request("/harness/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: sampleSpec, repoPath: tmpDir }),
    });

    assert.strictEqual(res.status, 202);
    const json = (await res.json()) as any;
    assert.ok(json.runId);
    assert.strictEqual(json.specId, "route-test-spec");

    // Query run status via GET /harness/runs/:runId
    const getRes = await app.request(`/harness/runs/${json.runId}`);
    assert.strictEqual(getRes.status, 200);
    const getJson = (await getRes.json()) as any;
    assert.strictEqual(getJson.run.id, json.runId);
  });

  it("POST /harness/runs/:runId/resume returns 202 Accepted for existing run (AC4)", async () => {
    // Create initial run record manually in store
    const initialRun = stageStore.createRun({
      spec: {
        id: "resume-route-spec",
        title: "Resume Route Spec",
        version: "1.0.0",
        description: "Test description",
        stages: ["spec", "implement"],
        acceptanceCriteria: [],
        dependencies: [],
      },
      repoPath: tmpDir,
    });
    stageStore.updateRun(initialRun.id, { status: "failed" });

    const res = await app.request(`/harness/runs/${initialRun.id}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 202);
    const json = (await res.json()) as any;
    assert.strictEqual(json.runId, initialRun.id);
  });
});
