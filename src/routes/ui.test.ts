import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { createUiRoutes } from "./ui.js";

describe("UI routes", () => {
  const app = new Hono();
  app.route("/ui", createUiRoutes());

  it("serves spec editor UI", async () => {
    const res = await app.request("/ui/spec-editor");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));
    const body = await res.text();
    assert.ok(body.includes("Spec Editor"));
    assert.ok(body.includes("textarea") || body.includes("<textarea"));
    assert.ok(body.includes("Save") && body.includes("Run"));
    assert.ok(body.includes("/specs/validate"));
    assert.ok(body.includes("/harness/runs"));
  });
});
