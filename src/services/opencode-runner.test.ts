import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import {
  OpenCodeRunner,
  captureGitStatusPorcelain,
  execOpenCodeCli,
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

  it("should attach git status porcelain to artifacts and rawResult", () => {
    const out = normalizeOpenCodeResult(
      "implement",
      {
        exitCode: 0,
        stdout: "done",
        stderr: "",
        gitStatusPorcelain: " M src/foo.ts\n",
      },
      8,
      [],
    );
    assert.strictEqual(out.status, "success");
    assert.ok(out.artifacts?.some((a) => a.includes("git-status:")));
    assert.ok(out.artifacts?.some((a) => a.includes("src/foo.ts")));
    const raw = out.rawResult as OpenCodeExecResult;
    assert.strictEqual(raw.gitStatusPorcelain, " M src/foo.ts\n");
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

  it("should forward stdout/stderr chunks via onLog before completion", async () => {
    const received: string[] = [];
    const runner = new OpenCodeRunner(
      mockExec(async (req) => {
        assert.ok(req.onLog, "onLog should be passed to exec");
        await new Promise((r) => setTimeout(r, 5));
        req.onLog!("alpha");
        await new Promise((r) => setTimeout(r, 5));
        req.onLog!("[stderr] warn\n");
        return {
          exitCode: 0,
          stdout: "alphawarn",
          stderr: "warn",
        };
      }),
    );

    const out = await runner.executeStage({
      stage: "implement",
      repoPath: "/tmp/non-git-repo-for-stream-test",
      prompt: "stream test",
      options: {
        onLog: (chunk: string) => received.push(chunk),
      },
    });

    assert.strictEqual(out.status, "success");
    assert.deepStrictEqual(received, ["alpha", "[stderr] warn\n"]);
    assert.ok(out.logs.some((l) => l.includes("alphawarn")));
  });

  it("should attach git status from a temp repo", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "opencode-git-"));
    const runner = new OpenCodeRunner(
      mockExec(async () => ({
        exitCode: 0,
        stdout: "ok",
        stderr: "",
      })),
    );

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync("git", ["init"], { cwd: dir });
    await writeFile(path.join(dir, "tracked.txt"), "hello");

    const out = await runner.executeStage({
      stage: "implement",
      repoPath: dir,
      prompt: "git test",
    });

    assert.strictEqual(out.status, "success");
    assert.ok(
      out.artifacts?.some((a) => a.includes("git-status:")),
      "expected git-status artifact",
    );
    const raw = out.rawResult as OpenCodeExecResult;
    assert.ok(raw.gitStatusPorcelain?.includes("tracked.txt"));
  });

  it("should skip git status gracefully when not a git repo", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "opencode-nogit-"));
    const runner = new OpenCodeRunner(
      mockExec(async () => ({
        exitCode: 0,
        stdout: "ok",
        stderr: "",
      })),
    );

    const out = await runner.executeStage({
      stage: "build",
      repoPath: dir,
      prompt: "no git",
    });

    assert.strictEqual(out.status, "success");
    assert.ok(out.logs.some((l) => l.includes("Git status skipped:")));
    const raw = out.rawResult as OpenCodeExecResult;
    assert.strictEqual(raw.gitStatusPorcelain, undefined);
  });
});

describe("execOpenCodeCli streaming", () => {
  it("forwards delayed stdout/stderr chunks via onLog", async () => {
    const received: string[] = [];
    const mockChild = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = () => {};

    const mockSpawn = (() => mockChild) as unknown as typeof import("node:child_process").spawn;

    const promise = execOpenCodeCli(
      {
        stage: "implement",
        repoPath: "/tmp/repo",
        prompt: "hi",
        timeoutMs: 5000,
        onLog: (chunk: string) => received.push(chunk),
      },
      mockSpawn,
    );

    setTimeout(() => mockChild.stdout.emit("data", "chunk-1"), 10);
    setTimeout(() => mockChild.stderr.emit("data", "err-1"), 20);
    setTimeout(() => mockChild.emit("close", 0), 30);

    const result = await promise;
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, "chunk-1");
    assert.strictEqual(result.stderr, "err-1");
    assert.deepStrictEqual(received, ["chunk-1", "[stderr] err-1"]);
  });
});

describe("captureGitStatusPorcelain", () => {
  it("returns porcelain for initialized repo", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "opencode-capture-"));
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync("git", ["init"], { cwd: dir });
    await writeFile(path.join(dir, "new.txt"), "x");

    const result = await captureGitStatusPorcelain(dir);
    assert.ok(result.porcelain?.includes("new.txt"));
    assert.strictEqual(result.skippedReason, undefined);
  });

  it("returns skippedReason when not a git repo", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "opencode-capture-ng-"));
    const result = await captureGitStatusPorcelain(dir);
    assert.strictEqual(result.porcelain, undefined);
    assert.ok(result.skippedReason?.includes("not a git repository"));
  });
});
