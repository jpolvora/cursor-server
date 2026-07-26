import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildTaskPrompt,
  extractStepHintFromOutput,
  mapProgressHint,
} from "./board-step-sync.js";

describe("board-step-sync", () => {
  it("maps implement hints to implementing lane", () => {
    const result = mapProgressHint("full", "step-04 implement phase");
    assert.strictEqual(result.lane, "implementing");
  });

  it("maps review hints to review lane", () => {
    const result = mapProgressHint("full", "step-06 review");
    assert.strictEqual(result.lane, "review");
  });

  it("maps ship and fix-pr hints to ship lane", () => {
    assert.strictEqual(mapProgressHint("full", "step-08 ship").lane, "ship");
    assert.strictEqual(mapProgressHint("lite", "fix-pr loop").lane, "ship");
  });

  it("maps failed task status to blocked", () => {
    const result = mapProgressHint("full", "running", "failed");
    assert.strictEqual(result.lane, "blocked");
  });

  it("builds spec-to-pr task prompts", () => {
    assert.strictEqual(
      buildTaskPrompt(".agents/specs/foo.spec.md", "full", ["auto"]),
      "/ws-spec-to-pr auto .agents/specs/foo.spec.md",
    );
    assert.strictEqual(
      buildTaskPrompt(".agents/specs/foo.spec.md", "lite"),
      "/ws-spec-to-pr-lite auto .agents/specs/foo.spec.md",
    );
  });

  it("extracts step hints from output chunks", () => {
    const hint = extractStepHintFromOutput("log line\nStarting step-06 review pass\n");
    assert.ok(hint?.includes("review"));
  });
});
