import { describe, it } from "node:test";
import assert from "node:assert";
import {
  HarnessRunner,
  LocalCursorRunner,
  RunnerRegistry,
  runnerRegistry,
  StageInput,
  StageOutput,
} from "./harness-runner.js";

describe("RunnerRegistry", () => {
  it("should have cursor-local registered by default", () => {
    const runner = runnerRegistry.get("cursor-local");
    assert.ok(runner);
    assert.strictEqual(runner?.name, "Local Cursor SDK Runner");
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
    assert.strictEqual(registry.list().length, 2);
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
