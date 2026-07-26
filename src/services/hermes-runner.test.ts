import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import {
  HermesRunner,
  buildHermesCliArgs,
  isHermesCliResolvable,
  normalizeHermesResult,
  resolveHermesBin,
  resolveHermesSkills,
  type HermesExecFn,
  type HermesExecRequest,
  type HermesExecResult,
} from "./hermes-runner.js";
import { runnerRegistry } from "./harness-runner.js";

function mockExec(
  impl: (req: HermesExecRequest) => Promise<HermesExecResult> | HermesExecResult,
): HermesExecFn {
  return async (req) => impl(req);
}

describe("HermesRunner registry", () => {
  it("should register hermes by default", () => {
    const runner = runnerRegistry.get("hermes");
    assert.ok(runner);
    assert.strictEqual(runner?.id, "hermes");
    assert.strictEqual(runner?.name, "Hermes Agent Runner");
  });

  it("should keep cursor-local as default", () => {
    assert.strictEqual(runnerRegistry.getDefaultId(), "cursor-local");
  });
});

describe("resolveHermesSkills", () => {
  it("should use options.skills array when provided", () => {
    assert.deepStrictEqual(
      resolveHermesSkills("implement", { skills: ["coding", "review"] }),
      ["coding", "review"],
    );
  });

  it("should parse comma-separated skills string", () => {
    assert.deepStrictEqual(resolveHermesSkills("test", { skills: "a, b" }), [
      "a",
      "b",
    ]);
  });

  it("should fall back to stage defaults", () => {
    assert.deepStrictEqual(resolveHermesSkills("spec"), ["planning"]);
    assert.deepStrictEqual(resolveHermesSkills("implement"), ["coding"]);
  });
});

describe("normalizeHermesResult", () => {
  it("should map exitCode 0 to success with artifacts and skill logs", () => {
    const logs: string[] = [];
    const out = normalizeHermesResult(
      "implement",
      {
        exitCode: 0,
        stdout: "done",
        stderr: "",
        skillsLoaded: ["coding"],
        artifacts: ["done"],
      },
      12,
      logs,
    );
    assert.strictEqual(out.status, "success");
    assert.strictEqual(out.durationMs, 12);
    assert.deepStrictEqual(out.artifacts, ["done"]);
    assert.ok(logs.some((l) => l.includes("Skills loaded: coding")));
  });

  it("should map non-zero exit to failed", () => {
    const out = normalizeHermesResult(
      "build",
      { exitCode: 2, stdout: "", stderr: "boom" },
      5,
      [],
    );
    assert.strictEqual(out.status, "failed");
    assert.strictEqual(out.error, "boom");
  });
});

describe("buildHermesCliArgs", () => {
  it("should build chat -q one-shot argv without skills", () => {
    assert.deepStrictEqual(
      buildHermesCliArgs({ prompt: "implement feature", skills: [] }),
      ["chat", "-q", "implement feature"],
    );
  });

  it("should append -s skills comma-separated", () => {
    assert.deepStrictEqual(
      buildHermesCliArgs({ prompt: "run tests", skills: ["coding", "testing"] }),
      ["chat", "-q", "run tests", "-s", "coding,testing"],
    );
  });
});

describe("resolveHermesBin", () => {
  const original = process.env.HERMES_BIN;
  afterEach(() => {
    if (original === undefined) delete process.env.HERMES_BIN;
    else process.env.HERMES_BIN = original;
  });

  it("should default to hermes when HERMES_BIN unset", () => {
    delete process.env.HERMES_BIN;
    assert.strictEqual(resolveHermesBin(), "hermes");
  });

  it("should use HERMES_BIN override", () => {
    process.env.HERMES_BIN = "/opt/hermes/bin/hermes";
    assert.strictEqual(resolveHermesBin(), "/opt/hermes/bin/hermes");
  });
});

describe("isHermesCliResolvable", () => {
  it("should return false for a nonexistent absolute path", async () => {
    assert.strictEqual(
      await isHermesCliResolvable("/nonexistent/hermes-missing-12345"),
      false,
    );
  });
});

describe("HermesRunner.executeStage", () => {
  it("should dispatch to injectable exec with stage prompt and skills", async () => {
    let seen: HermesExecRequest | undefined;
    const runner = new HermesRunner(
      mockExec(async (req) => {
        seen = req;
        return {
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          skillsLoaded: req.skills,
        };
      }),
    );

    const out = await runner.executeStage({
      stage: "implement",
      repoPath: "/tmp/repo",
      prompt: "add feature",
      options: { skills: ["coding", "fable"] },
    });

    assert.strictEqual(out.status, "success");
    assert.ok(seen);
    assert.strictEqual(seen!.stage, "implement");
    assert.strictEqual(seen!.repoPath, "/tmp/repo");
    assert.ok(seen!.prompt.includes("Stage: implement"));
    assert.ok(seen!.prompt.includes("add feature"));
    assert.deepStrictEqual(seen!.skills, ["coding", "fable"]);
    assert.ok(out.logs.some((l) => l.includes("skills=coding,fable")));
  });

  it("should return error StageOutput on throw", async () => {
    const runner = new HermesRunner(
      mockExec(async () => {
        throw new Error("hermes missing");
      }),
    );
    const out = await runner.executeStage({
      stage: "spec",
      repoPath: "/tmp/repo",
      prompt: "plan",
    });
    assert.strictEqual(out.status, "error");
    assert.strictEqual(out.error, "hermes missing");
  });

  it("should return error on unsupported stage", async () => {
    const runner = new HermesRunner(mockExec(async () => ({
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
    const runner = new HermesRunner(
      mockExec(
        () =>
          new Promise<HermesExecResult>((resolve) => {
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
      stage: "test",
      repoPath: "/tmp/repo",
      prompt: "test",
      options: { timeoutMs: 20 },
    });
    assert.strictEqual(out.status, "error");
    assert.ok(out.error?.includes("timed out"));
  });

  it("should report healthy when HERMES_API_URL is set", async () => {
    const originalUrl = process.env.HERMES_API_URL;
    process.env.HERMES_API_URL = "http://localhost:8080";
    try {
      const runner = new HermesRunner();
      const health = await runner.healthCheck();
      assert.strictEqual(health.healthy, true);
      assert.ok(health.details?.includes("HERMES_API_URL"));
    } finally {
      if (originalUrl === undefined) delete process.env.HERMES_API_URL;
      else process.env.HERMES_API_URL = originalUrl;
    }
  });

  it("should report unhealthy when CLI binary is missing", async () => {
    const originalUrl = process.env.HERMES_API_URL;
    const originalBin = process.env.HERMES_BIN;
    delete process.env.HERMES_API_URL;
    process.env.HERMES_BIN = "/nonexistent/hermes-missing-12345";
    try {
      const runner = new HermesRunner();
      const health = await runner.healthCheck();
      assert.strictEqual(health.healthy, false);
      assert.ok(health.details?.includes("not found"));
    } finally {
      if (originalUrl === undefined) delete process.env.HERMES_API_URL;
      else process.env.HERMES_API_URL = originalUrl;
      if (originalBin === undefined) delete process.env.HERMES_BIN;
      else process.env.HERMES_BIN = originalBin;
    }
  });
});
