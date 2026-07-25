import { describe, it } from "node:test";
import assert from "node:assert";
import type { Config } from "../config.js";
import type { RunTaskInput, RunTaskResult } from "./agent-runner.js";
import {
  CursorSdkRunner,
  HarnessRunner,
  LocalCursorRunner,
  RunnerRegistry,
  runnerRegistry,
  StageInput,
  StageOutput,
  defaultAgentForStage,
  wrapStagePrompt,
  normalizeRunStatusToStageStatus,
  resolveTimeoutMs,
  resolveStageAgent,
  DEFAULT_STAGE_TIMEOUT_MS,
} from "./harness-runner.js";

function ensureTestApiKey(): void {
  if (!process.env.CURSOR_API_KEY) {
    process.env.CURSOR_API_KEY = "test-key-not-real";
  }
}

function mockResult(overrides: Partial<RunTaskResult> = {}): RunTaskResult {
  return {
    agent: "default",
    status: "finished",
    durationMs: 10,
    run: {
      agentId: "a1",
      runId: "r1",
      status: "finished",
      model: "composer-2",
      result: "ok",
    },
    result: "ok",
    ...overrides,
  };
}

describe("RunnerRegistry", () => {
  it("should have cursor-local registered by default", () => {
    const runner = runnerRegistry.get("cursor-local");
    assert.ok(runner);
    assert.strictEqual(runner?.name, "Local Cursor SDK Runner");
  });

  it("should register cursor-sdk by default", () => {
    const runner = runnerRegistry.get("cursor-sdk");
    assert.ok(runner);
    assert.strictEqual(runner?.id, "cursor-sdk");
    assert.strictEqual(runner?.name, "Cursor SDK Runner");
  });

  it("should keep cursor-local as default", () => {
    assert.strictEqual(runnerRegistry.getDefaultId(), "cursor-local");
    assert.strictEqual(runnerRegistry.getOrDefault().id, "cursor-local");
  });

  it("should resolve default runner when requested ID is missing", () => {
    const runner = runnerRegistry.getOrDefault("non-existent-runner");
    assert.ok(runner);
    assert.strictEqual(runner.id, "cursor-local");
  });

  it("should allow registering a custom runner and retrieving it", () => {
    const registry = new RunnerRegistry();
    const mockRunner: HarnessRunner = {
      id: "hermes-agent",
      name: "Hermes Agent Orchestrator",
      supportedStages: ["spec", "implement", "build", "test", "deploy", "review"],
      executeStage: async (input: StageInput): Promise<StageOutput> => ({
        stage: input.stage,
        status: "success",
        durationMs: 100,
        logs: ["Hermes stage complete"],
      }),
      healthCheck: async () => ({ healthy: true }),
    };

    registry.register(mockRunner);
    assert.strictEqual(registry.get("hermes-agent"), mockRunner);
    assert.strictEqual(registry.list().length, 3);
  });

  it("should allow setting a new default runner", () => {
    const registry = new RunnerRegistry();
    const mockRunner: HarnessRunner = {
      id: "opencode-cli",
      name: "OpenCode CLI Runner",
      supportedStages: ["implement", "test"],
      executeStage: async (input: StageInput) => ({
        stage: input.stage,
        status: "success",
        durationMs: 200,
        logs: [],
      }),
      healthCheck: async () => ({ healthy: true }),
    };

    registry.register(mockRunner);
    registry.setDefault("opencode-cli");
    assert.strictEqual(registry.getOrDefault().id, "opencode-cli");
  });

  it("should throw when setting default to an unregistered runner", () => {
    const registry = new RunnerRegistry();
    assert.throws(() => registry.setDefault("unknown"), /Cannot set default runner/);
  });

  it("should throw when unregistering default runner", () => {
    const registry = new RunnerRegistry();
    assert.throws(() => registry.unregister("cursor-local"), /Cannot unregister default runner/);
  });
});

describe("stage helpers", () => {
  it("should map default agents per stage", () => {
    assert.strictEqual(defaultAgentForStage("spec"), "planner");
    assert.strictEqual(defaultAgentForStage("review"), "planner");
    assert.strictEqual(defaultAgentForStage("implement"), "implementer");
    assert.strictEqual(defaultAgentForStage("build"), "default");
    assert.strictEqual(defaultAgentForStage("test"), "default");
  });

  it("should wrap prompts with stage intent", () => {
    const wrapped = wrapStagePrompt("spec", "do thing");
    assert.ok(wrapped.includes("Stage: spec"));
    assert.ok(wrapped.includes("do thing"));
  });

  it("should normalize run statuses", () => {
    assert.strictEqual(normalizeRunStatusToStageStatus("finished"), "success");
    assert.strictEqual(normalizeRunStatusToStageStatus("completed"), "success");
    assert.strictEqual(normalizeRunStatusToStageStatus("success"), "success");
    assert.strictEqual(normalizeRunStatusToStageStatus("error"), "failed");
    assert.strictEqual(normalizeRunStatusToStageStatus("cancelled"), "failed");
    assert.strictEqual(normalizeRunStatusToStageStatus("other"), "failed");
  });

  it("should resolve timeoutMs with default and override", () => {
    assert.strictEqual(resolveTimeoutMs(), DEFAULT_STAGE_TIMEOUT_MS);
    assert.strictEqual(resolveTimeoutMs({}), DEFAULT_STAGE_TIMEOUT_MS);
    assert.strictEqual(resolveTimeoutMs({ timeoutMs: 1000 }), 1000);
    assert.strictEqual(resolveTimeoutMs({ timeoutMs: 0 }), DEFAULT_STAGE_TIMEOUT_MS);
    assert.strictEqual(resolveTimeoutMs({ timeoutMs: -1 }), DEFAULT_STAGE_TIMEOUT_MS);
    assert.strictEqual(resolveTimeoutMs({ timeoutMs: Number.NaN }), DEFAULT_STAGE_TIMEOUT_MS);
  });

  it("should prefer options.agent over stage default", () => {
    assert.strictEqual(resolveStageAgent("implement"), "implementer");
    assert.strictEqual(resolveStageAgent("implement", { agent: "planner" }), "planner");
    assert.strictEqual(resolveStageAgent("spec", { agent: "  " }), "planner");
  });
});

describe("LocalCursorRunner", () => {
  it("should report healthy status", async () => {
    const runner = new LocalCursorRunner();
    const health = await runner.healthCheck();
    assert.strictEqual(health.healthy, true);
  });

  it("should handle unsupported stages with error status", async () => {
    const runner = new LocalCursorRunner();
    const input: StageInput = {
      stage: "deploy",
      repoPath: "./repos/sample-repo",
      prompt: "Deploy app",
    };

    const output = await runner.executeStage(input);
    assert.strictEqual(output.stage, "deploy");
    assert.strictEqual(output.status, "error");
    assert.ok(output.error?.includes("Stage 'deploy' is not supported"));
  });
});

describe("CursorSdkRunner", () => {
  it("should use planner for spec stage", async () => {
    ensureTestApiKey();
    let captured: RunTaskInput | undefined;
    const runner = new CursorSdkRunner(async (_config: Config, input: RunTaskInput) => {
      captured = input;
      return mockResult({ agent: input.agent });
    });

    await runner.executeStage({
      stage: "spec",
      repoPath: "./repos/sample",
      prompt: "Write a plan",
    });

    assert.strictEqual(captured?.agent, "planner");
    assert.ok(captured?.prompt.includes("Stage: spec"));
    assert.ok(captured?.prompt.includes("Write a plan"));
  });

  it("should use implementer for implement stage", async () => {
    ensureTestApiKey();
    let captured: RunTaskInput | undefined;
    const runner = new CursorSdkRunner(async (_config, input) => {
      captured = input;
      return mockResult({ agent: input.agent });
    });

    await runner.executeStage({
      stage: "implement",
      repoPath: "./repos/sample",
      prompt: "Add feature",
    });

    assert.strictEqual(captured?.agent, "implementer");
  });

  it("should map build test review default agents", async () => {
    ensureTestApiKey();
    const agents: string[] = [];
    const runner = new CursorSdkRunner(async (_config, input) => {
      agents.push(input.agent);
      return mockResult({ agent: input.agent });
    });

    for (const stage of ["build", "test", "review"] as const) {
      await runner.executeStage({
        stage,
        repoPath: "./repos/sample",
        prompt: "go",
      });
    }

    assert.deepStrictEqual(agents, ["default", "default", "planner"]);
  });

  it("should override stage default via options.agent", async () => {
    ensureTestApiKey();
    let captured: RunTaskInput | undefined;
    const runner = new CursorSdkRunner(async (_config, input) => {
      captured = input;
      return mockResult({ agent: input.agent });
    });

    await runner.executeStage({
      stage: "implement",
      repoPath: "./repos/sample",
      prompt: "Add feature",
      options: { agent: "plan+implementer" },
    });

    assert.strictEqual(captured?.agent, "plan+implementer");
  });

  it("should pass model through to runTask", async () => {
    ensureTestApiKey();
    let captured: RunTaskInput | undefined;
    const runner = new CursorSdkRunner(async (_config, input) => {
      captured = input;
      return mockResult();
    });

    await runner.executeStage({
      stage: "build",
      repoPath: "./repos/sample",
      prompt: "build",
      options: { model: "composer-2-fast" },
    });

    assert.strictEqual(captured?.model, "composer-2-fast");
  });

  it("should normalize successful StageOutput", async () => {
    ensureTestApiKey();
    const runner = new CursorSdkRunner(async () =>
      mockResult({
        status: "finished",
        result: "done text",
        plan: {
          agentId: "p1",
          runId: "pr1",
          status: "finished",
          model: "composer-2",
          result: "plan text",
        },
      }),
    );

    const output = await runner.executeStage({
      stage: "implement",
      repoPath: "./repos/sample",
      prompt: "go",
    });

    assert.strictEqual(output.status, "success");
    assert.ok(output.durationMs >= 0);
    assert.ok(output.logs.length > 0);
    assert.ok(output.artifacts?.includes("done text"));
    assert.ok(output.artifacts?.includes("plan text"));
    assert.ok(output.rawResult);
  });

  it("should map SDK error status to failed", async () => {
    ensureTestApiKey();
    const runner = new CursorSdkRunner(async () =>
      mockResult({ status: "error", result: "boom" }),
    );

    const output = await runner.executeStage({
      stage: "test",
      repoPath: "./repos/sample",
      prompt: "go",
    });

    assert.strictEqual(output.status, "failed");
    assert.ok(output.rawResult);
  });

  it("should map SDK cancelled status to failed", async () => {
    ensureTestApiKey();
    const runner = new CursorSdkRunner(async () =>
      mockResult({ status: "cancelled" }),
    );

    const output = await runner.executeStage({
      stage: "review",
      repoPath: "./repos/sample",
      prompt: "go",
    });

    assert.strictEqual(output.status, "failed");
  });

  it("should return error StageOutput on throw", async () => {
    ensureTestApiKey();
    const runner = new CursorSdkRunner(async () => {
      throw new Error("startup failed");
    });

    const output = await runner.executeStage({
      stage: "spec",
      repoPath: "./repos/sample",
      prompt: "go",
    });

    assert.strictEqual(output.status, "error");
    assert.strictEqual(output.error, "startup failed");
    assert.ok(output.logs.some((l) => l.includes("startup failed")));
  });

  it("should return error on timeout", async () => {
    ensureTestApiKey();
    let rejectLate: ((err: Error) => void) | undefined;
    const late = new Promise<RunTaskResult>((_resolve, reject) => {
      rejectLate = reject;
    });

    const runner = new CursorSdkRunner(() => late);

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const output = await runner.executeStage({
        stage: "implement",
        repoPath: "./repos/sample",
        prompt: "go",
        options: { timeoutMs: 30 },
      });

      assert.strictEqual(output.status, "error");
      assert.ok(output.error?.includes("timed out"));
      assert.ok(output.logs.some((l) => l.includes("timed out")));

      rejectLate?.(new Error("late rejection"));
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(unhandled.length, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("should reject unsupported deploy stage", async () => {
    const runner = new CursorSdkRunner(async () => mockResult());
    const output = await runner.executeStage({
      stage: "deploy",
      repoPath: "./repos/sample",
      prompt: "deploy",
    });

    assert.strictEqual(output.status, "error");
    assert.ok(output.error?.includes("not supported"));
  });

  it("should report healthy status", async () => {
    const runner = new CursorSdkRunner();
    const health = await runner.healthCheck();
    assert.strictEqual(health.healthy, true);
    assert.ok(typeof health.details === "string");
  });
});
