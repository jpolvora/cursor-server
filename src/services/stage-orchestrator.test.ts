import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { stageStore } from "./stage-store.js";
import { stageOrchestrator } from "./stage-orchestrator.js";
import { runnerRegistry, type HarnessRunner, type HarnessStage, type StageInput, type StageOutput } from "./harness-runner.js";
import type { QualifiedSpec } from "./spec-schema.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const sampleSpec: QualifiedSpec = {
  id: "test-stage-spec",
  title: "Test Stage Spec",
  version: "1.0.0",
  description: "Test description for pipeline runner",
  stages: ["spec", "implement", "build", "test"],
  acceptanceCriteria: [
    {
      id: "AC1",
      title: "First criterion",
      given: "State is initial",
      when: "Action runs",
      then: "Result is valid",
      verificationStage: "test",
    },
  ],
  dependencies: [],
};

class MockRunner implements HarnessRunner {
  readonly id = "mock-runner";
  readonly name = "Mock Test Runner";
  readonly supportedStages: HarnessStage[] = ["spec", "implement", "build", "test", "deploy", "review"];

  public executedStages: string[] = [];
  public failStage: string | null = null;

  async executeStage(input: StageInput): Promise<StageOutput> {
    this.executedStages.push(input.stage);

    if (this.failStage === input.stage) {
      return {
        stage: input.stage,
        status: "failed",
        durationMs: 10,
        logs: [`Stage ${input.stage} failed as instructed`],
        error: `Forced error in stage ${input.stage}`,
      };
    }

    return {
      stage: input.stage,
      status: "success",
      durationMs: 15,
      logs: [`Stage ${input.stage} completed successfully`],
      artifacts: [`artifact-${input.stage}.log`],
    };
  }

  async healthCheck() {
    return { healthy: true };
  }
}

describe("StageOrchestrator & StageStore", () => {
  let tmpDir: string;
  let mockRunner: MockRunner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage-test-"));
    stageStore.init(tmpDir);
    stageStore.clear();

    mockRunner = new MockRunner();
    runnerRegistry.register(mockRunner);
  });

  it("executes stages sequentially and records observability metrics (AC1 & AC2)", async () => {
    const run = await stageOrchestrator.run(sampleSpec, tmpDir, { runnerId: "mock-runner" });

    assert.strictEqual(run.status, "success");
    assert.deepStrictEqual(mockRunner.executedStages, ["spec", "implement", "build", "test"]);
    assert.strictEqual(run.stages.length, 4);

    for (const stageRec of run.stages) {
      assert.strictEqual(stageRec.status, "success");
      assert.ok((stageRec.durationMs ?? 0) >= 0);
      assert.ok(stageRec.logs.length > 0);
      assert.deepStrictEqual(stageRec.artifacts, [`artifact-${stageRec.stage}.log`]);
    }
  });

  it("stops pipeline execution upon stage failure (AC2)", async () => {
    mockRunner.failStage = "build";

    const run = await stageOrchestrator.run(sampleSpec, tmpDir, { runnerId: "mock-runner" });

    assert.strictEqual(run.status, "failed");
    assert.deepStrictEqual(mockRunner.executedStages, ["spec", "implement", "build"]);
    assert.strictEqual(run.stages.find((s) => s.stage === "build")?.status, "failed");
    assert.strictEqual(run.stages.find((s) => s.stage === "test")?.status, "pending");
  });

  it("resumes execution from the failed stage without re-executing successful stages (AC3)", async () => {
    // 1. Initial run fails at 'build' stage
    mockRunner.failStage = "build";
    const initialRun = await stageOrchestrator.run(sampleSpec, tmpDir, { runnerId: "mock-runner" });

    assert.strictEqual(initialRun.status, "failed");
    assert.deepStrictEqual(mockRunner.executedStages, ["spec", "implement", "build"]);

    // Reset mock execution tracking and remove failure condition
    mockRunner.executedStages = [];
    mockRunner.failStage = null;

    // 2. Resume execution
    const resumedRun = await stageOrchestrator.resume(initialRun.id, { runnerId: "mock-runner" });

    assert.strictEqual(resumedRun.status, "success");
    // Should skip 'spec' and 'implement', starting directly from 'build'
    assert.deepStrictEqual(mockRunner.executedStages, ["build", "test"]);
  });
});
