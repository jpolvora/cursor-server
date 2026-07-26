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
    assert.ok(body.includes("/ui/spec-editor-client.js"));
    assert.ok(body.includes("AC Builder"));
    assert.ok(body.includes("Stage Designer"));
    assert.ok(body.includes("Dependencies"));
  });

  it("serves spec editor client script", async () => {
    const res = await app.request("/ui/spec-editor-client.js");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("javascript"));
    const body = await res.text();
    assert.ok(body.includes("parseACs"));
    assert.ok(body.includes("/specs/validate"));
    assert.ok(body.includes("/harness/runs"));
    assert.ok(body.includes("detectCycles"));
    assert.ok(body.includes("cursorServerAuth"));
  });

  it("serves agent prompt UI", async () => {
    const res = await app.request("/ui/prompt");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));
    const body = await res.text();
    assert.ok(body.includes("Agent Prompt"));
    assert.ok(body.includes("data-cursor-prompt-widget"));
    assert.ok(body.includes("/ui/prompt-widget.js"));
    assert.ok(body.includes("prompt → task"));
  });

  it("serves embeddable prompt widget script", async () => {
    const res = await app.request("/ui/prompt-widget.js");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("javascript"));
    const body = await res.text();
    assert.ok(body.includes("CursorPromptWidget"));
    assert.ok(body.includes("data-cursor-prompt-widget"));
    assert.ok(body.includes("/tasks"));
    // Standalone embeds still collect their own key; the shell supplies it otherwise.
    assert.ok(body.includes("pw-api-key"));
  });

  it("serves board Kanban UI inside the shell", async () => {
    const res = await app.request("/ui/board");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));
    const body = await res.text();
    assert.ok(body.includes("Kanban Board"));
    assert.ok(body.includes('id="main-pane"'));
    assert.ok(body.includes("/ui/app.css"));
    assert.ok(body.includes("/ui/board-client.js"));
    assert.ok(body.includes("/ui/spec-editor"));
    assert.ok(body.includes("/ui/projects"));
    assert.ok(body.includes("start-modal"));
    assert.ok(body.includes("Start card"));
  });

  it("serves board client script with lane and run control behavior", async () => {
    const res = await app.request("/ui/board-client.js");
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("javascript"));
    const body = await res.text();
    assert.ok(body.includes("/board/cards"));
    assert.ok(body.includes("backlog") && body.includes("implementing"));
    assert.ok(body.includes("dragstart") || body.includes("draggable"));
    assert.ok(body.includes("Open in spec-editor"));
    assert.ok(body.includes("/board/cards/") && body.includes("/start"));
    assert.ok(body.includes("/pause") && body.includes("/resume") && body.includes("/finish"));
    assert.ok(body.includes("badge failed"));
    assert.ok(body.includes("Resume"));
    assert.ok(body.includes("cursorServerAuth"));
  });
});
