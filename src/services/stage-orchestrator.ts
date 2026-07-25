import { runnerRegistry, type HarnessStage } from "./harness-runner.js";
import "./hermes-runner.js";
import { stageStore, type PipelineRunRecord } from "./stage-store.js";
import type { QualifiedSpec } from "./spec-schema.js";

export interface StageRunOptions {
  runnerId?: string;
  agent?: string;
  model?: string;
  config?: any;
}

export class StageOrchestrator {
  /**
   * Run a qualified spec sequentially through its stages.
   */
  public async run(
    spec: QualifiedSpec,
    repoPath: string,
    options?: StageRunOptions
  ): Promise<PipelineRunRecord> {
    const runRecord = stageStore.createRun({
      spec,
      repoPath,
      runnerId: options?.runnerId,
    });

    return this.executePipeline(runRecord.id, options);
  }

  /**
   * Start a run asynchronously in the background.
   */
  public runAsync(
    spec: QualifiedSpec,
    repoPath: string,
    options?: StageRunOptions
  ): PipelineRunRecord {
    const runRecord = stageStore.createRun({
      spec,
      repoPath,
      runnerId: options?.runnerId,
    });

    // Execute background process without awaiting
    this.executePipeline(runRecord.id, options).catch((err) => {
      console.error(`Background pipeline execution failed for run ${runRecord.id}:`, err);
    });

    return stageStore.getRun(runRecord.id) || runRecord;
  }

  /**
   * Resume a failed or incomplete pipeline run starting from the first non-successful stage.
   */
  public async resume(runId: string, options?: StageRunOptions): Promise<PipelineRunRecord> {
    const existingRun = stageStore.getRun(runId);
    if (!existingRun) {
      throw new Error(`Pipeline run '${runId}' not found`);
    }

    if (existingRun.status === "success") {
      return existingRun;
    }

    return this.executePipeline(runId, options);
  }

  /**
   * Resume a run asynchronously in the background.
   */
  public resumeAsync(runId: string, options?: StageRunOptions): PipelineRunRecord {
    const existingRun = stageStore.getRun(runId);
    if (!existingRun) {
      throw new Error(`Pipeline run '${runId}' not found`);
    }

    if (existingRun.status === "success") {
      return existingRun;
    }

    this.executePipeline(runId, options).catch((err) => {
      console.error(`Background pipeline resume failed for run ${runId}:`, err);
    });

    return stageStore.getRun(runId) || existingRun;
  }

  /**
   * Internal pipeline execution loop handling sequential stages and resumability.
   */
  private async executePipeline(runId: string, options?: StageRunOptions): Promise<PipelineRunRecord> {
    const run = stageStore.getRun(runId);
    if (!run) {
      throw new Error(`Pipeline run '${runId}' not found`);
    }

    const runner = runnerRegistry.getOrDefault(options?.runnerId || run.runnerId);
    const startTime = Date.now();

    stageStore.updateRun(runId, {
      status: "running",
      startedAt: run.startedAt || new Date().toISOString(),
      error: undefined,
    });

    let overallFailed = false;

    for (let i = 0; i < run.stages.length; i++) {
      const stageRecord = run.stages[i];

      // AC3: Resumability & Checkpointing
      // Skip earlier stages that already completed with success
      if (stageRecord.status === "success") {
        continue;
      }

      const stageName = stageRecord.stage;
      stageStore.updateRun(runId, { currentStage: stageName });

      stageStore.updateStage(runId, stageName, {
        status: "running",
        startedAt: new Date().toISOString(),
        logs: [...stageRecord.logs, `Executing stage ${stageName}`],
      });

      // Prepare prompt from spec acceptance criteria and description
      const stagePrompt = this.buildStagePrompt(run.spec, stageName);

      try {
        const stageOutput = await runner.executeStage({
          stage: stageName,
          repoPath: run.repoPath,
          prompt: stagePrompt,
          options: {
            ...options,
            agent: options?.agent,
            model: options?.model,
            config: options?.config,
          },
        });

        const completedAt = new Date().toISOString();
        const stageStatus = stageOutput.status;

        stageStore.updateStage(runId, stageName, {
          status: stageStatus,
          completedAt,
          durationMs: stageOutput.durationMs,
          logs: [...stageRecord.logs, ...stageOutput.logs],
          artifacts: stageOutput.artifacts,
          error: stageOutput.error,
        });

        if (stageStatus !== "success") {
          overallFailed = true;
          stageStore.updateRun(runId, {
            status: stageStatus === "error" ? "error" : "failed",
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            error: stageOutput.error || `Stage '${stageName}' failed with status: ${stageStatus}`,
          });
          break;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        overallFailed = true;

        stageStore.updateStage(runId, stageName, {
          status: "error",
          completedAt: new Date().toISOString(),
          error: errorMsg,
          logs: [...stageRecord.logs, `Stage execution exception: ${errorMsg}`],
        });

        stageStore.updateRun(runId, {
          status: "error",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          error: errorMsg,
        });

        break;
      }
    }

    if (!overallFailed) {
      stageStore.updateRun(runId, {
        status: "success",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });
    }

    return stageStore.getRun(runId)!;
  }

  /**
   * Helper to construct stage prompts linked back to spec requirements & criteria.
   */
  private buildStagePrompt(spec?: QualifiedSpec, stage?: HarnessStage): string {
    if (!spec) {
      return `Execute stage ${stage}`;
    }

    const stageCriteria = spec.acceptanceCriteria.filter(
      (ac) => ac.verificationStage === stage || stage === "implement" || stage === "test"
    );

    let prompt = `Spec: ${spec.title} (ID: ${spec.id})\n`;
    if (spec.description) {
      prompt += `Description: ${spec.description}\n`;
    }

    prompt += `Stage: ${stage}\n`;

    if (stageCriteria.length > 0) {
      prompt += `Acceptance Criteria for Stage:\n`;
      for (const ac of stageCriteria) {
        prompt += `- [${ac.id}] ${ac.title}: Given ${ac.given}, When ${ac.when}, Then ${ac.then}\n`;
      }
    }

    return prompt;
  }
}

export const stageOrchestrator = new StageOrchestrator();
