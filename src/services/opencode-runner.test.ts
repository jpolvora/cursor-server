import { describe, it } from "node:test";
import assert from "node:assert";
import {
  OpenCodeRunner,
  normalizeOpenCodeResult,
  type OpenCodeExecFn,
  type OpenCodeExecRequest,
  type OpenCodeExecResult,
} from "./opencode-runner.js";
import { runnerRegistry } from "./harness-runner.js";

function mockExec(
  impl: (req: OpenCodeExecRequest) => Promise<OpenCodeExecResult> | OpenCodeExecResult,
): OpenCodeExecFn {
  return async (req) => impl(req);
}

describe("OpenCodeRunner registry", () => {
  it("should register opencode by default", () => {
    const runner = runnerRegistry.get("opencode");
    assert.ok(runner);
    assert.strictEqual(runner?.id, "opencode");
    assert.strictEqual(runner?.name, "OpenCode CLI Runner");
  });

  it("should keep cursor-local as default", () => {
    assert.strictEqual(runnerRegistry.getDefaultId(), "cursor-local");
  });
});

describe("normalizeOpenCodeResult", () => {
  it("should map exitCode 0 to success with artifacts and logs", () => {
    const logs: string[] = [];
    const out = normalizeOpenCodeResult(
      "implement",
      {
        exitCode: 0,
        stdout: "done",
        stderr: "",
        artifacts: ["done"],
      },
      12,
      logs,
    );
    assert.strictEqual(out.status, "success");
    assert.strictEqual(out.durationMs, 12);
    assert.deepStrictEqual(out.artifacts, ["done"]);
  });

  it("should map non-zero exit to failed", () => {
    const out = normalizeOpenCodeResult(
      "build",
      { exitCode: 2, stdout: "", stderr: "boom" },
      5,
      [],
    );
    assert.strictEqual(out.status, "failed");
    assert.strictEqual(out.error, "boom");
  });

  it("should map explicit error status", () => {
    const out = normalizeOpenCodeResult(
      "test",
      { exitCode: 0, stdout: "", stderr: "warn", status: "error" },
      3,
      [],
    );
    assert.strictEqual(out.status, "error");
  });
});

describe("OpenCodeRunner.executeStage", () => {
  it("should dispatch to injectable exec with stage prompt", async () => {
    let seen: OpenCodeExecRequest | undefined;
    const runner = new OpenCodeRunner(
      mockExec(async (req) => {
        seen = req;
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: "",
        };
      }),
    );

    const out = await runner.executeStage({
      stage: "implement",
      repoPath: "/tmp/repo",
      prompt: "add feature",
      options: { engine: "opencode", model: "opencode-go/deepseek-v4-flash" },
    });

    assert.strictEqual(out.status, "success");
    assert.ok(seen);
    assert.strictEqual(seen!.stage, "implement");
    assert.strictEqual(seen!.repoPath, "/tmp/repo");
    assert.ok(seen!.prompt.includes("Stage: implement"));
    assert.ok(seen!.prompt.includes("add feature"));
    assert.strictEqual(seen!.options?.engine, "opencode");
    assert.strictEqual(seen!.options?.model, "opencode-go/deepseek-v4-flash");
  });

  it("should return error StageOutput on throw", async () => {
    const runner = new OpenCodeRunner(
      mockExec(async () => {
        throw new Error("opencode missing");
      }),
    );
    const out = await runner.executeStage({
      stage: "implement",
      repoPath: "/tmp/repo",
      prompt: "build",
    });
    assert.strictEqual(out.status, "error");
    assert.strictEqual(out.error, "opencode missing");
  });

  it("should return error on unsupported stage", async () => {
    const runner = new OpenCodeRunner(mockExec(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    })));
    const out = await runner.executeStage({
      stage: "spec",
      repoPath: "/tmp/repo",
      prompt: "plan",
    });
    assert.strictEqual(out.status, "error");
    assert.ok(out.error?.includes("not supported"));
  });

  it("should reject unsupported deploy stage", async () => {
    const runner = new OpenCodeRunner(mockExec(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    })));
    const out = await runner.executeStage({
      stage: "deploy",
      repoPath: "/tmp/repo",
      prompt: "deploy",
    });
    assert.strictEqual(out.status, "error");
    assert.ok(out.error?.includes("not supported"));
  });

  it("should timeout and clear timer", async () => {
    const runner = new OpenCodeRunner(
      mockExec(
        () =>
          new Promise<OpenCodeExecResult>((resolve) => {
            setTimeout(
              () =>
                resolve({
                  exitCode: 0,
                  stdout: "late",
                  stderr: "",
                }),
              200,
            );
          }),
      ),
    );
    const out = await runner.executeStage({
      stage: "build",
      repoPath: "/tmp/repo",
      prompt: "build",
      options: { timeoutMs: 20 },
    });
    assert.strictEqual(out.status, "error");
    assert.ok(out.error?.includes("timed out"));
  });

  it("should report healthy without live binary", async () => {
    const runner = new OpenCodeRunner();
    const health = await runner.healthCheck();
    assert.strictEqual(health.healthy, true);
    assert.ok(health.details);
  });
});
