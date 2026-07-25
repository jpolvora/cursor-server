import { resolveAgent, type AgentId } from "../agents.js";
import { resolveConfig, type Config } from "../config.js";
import { runTask, type RunTaskInput, type RunTaskResult } from "./agent-runner.js";

export type HarnessStage = 'spec' | 'implement' | 'build' | 'test' | 'deploy' | 'review';

export interface StageInput {
  stage: HarnessStage;
  repoPath: string;
  prompt: string;
  options?: Record<string, unknown>;
}

export interface StageOutput {
  stage: HarnessStage;
  status: 'success' | 'failed' | 'error';
  durationMs: number;
  logs: string[];
  artifacts?: string[];
  error?: string;
  rawResult?: unknown;
}

export interface HarnessRunner {
  id: string;
  name: string;
  supportedStages: HarnessStage[];
  executeStage(input: StageInput): Promise<StageOutput>;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;
}

export const DEFAULT_STAGE_TIMEOUT_MS = 600_000;

export type RunTaskFn = (
  config: Config,
  input: RunTaskInput,
) => Promise<RunTaskResult>;

export function defaultAgentForStage(stage: HarnessStage): AgentId {
  switch (stage) {
    case "implement":
      return "implementer";
    case "spec":
    case "review":
      return "planner";
    case "build":
    case "test":
    default:
      return "default";
  }
}

export function wrapStagePrompt(stage: HarnessStage, prompt: string): string {
  const headers: Record<string, string> = {
    spec: "Stage: spec. Plan only; do not edit files. Produce a concrete plan for the task below.",
    implement: "Stage: implement. Implement the task below; make necessary code changes.",
    build: "Stage: build. Run or verify the build; report pass/fail clearly.",
    test: "Stage: test. Run or verify tests; report pass/fail clearly.",
    review: "Stage: review. Review only; produce findings; do not implement.",
    deploy: "Stage: deploy.",
  };
  return `${headers[stage] ?? `Stage: ${stage}.`}\n\n${prompt}`;
}

export function normalizeRunStatusToStageStatus(
  runStatus: string,
): "success" | "failed" {
  const s = runStatus.toLowerCase();
  if (s === "finished" || s === "completed" || s === "success") {
    return "success";
  }
  return "failed";
}

export function resolveTimeoutMs(options?: Record<string, unknown>): number {
  const raw = options?.timeoutMs;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_STAGE_TIMEOUT_MS;
}

export function resolveStageAgent(
  stage: HarnessStage,
  options?: Record<string, unknown>,
): AgentId {
  const raw = options?.agent;
  if (typeof raw === "string" && raw.trim() !== "") {
    return resolveAgent(raw);
  }
  return defaultAgentForStage(stage);
}

export function resolveStageModel(
  options?: Record<string, unknown>,
): string | undefined {
  const raw = options?.model;
  return typeof raw === "string" ? raw : undefined;
}

function collectArtifacts(result: RunTaskResult): string[] {
  const artifacts: string[] = [];
  if (result.result && result.result.trim() !== "") {
    artifacts.push(result.result);
  }
  const planResult = result.plan?.result;
  if (planResult && planResult.trim() !== "" && planResult !== result.result) {
    artifacts.push(planResult);
  }
  return artifacts;
}

export class LocalCursorRunner implements HarnessRunner {
  readonly id = "cursor-local";
  readonly name = "Local Cursor SDK Runner";
  readonly supportedStages: HarnessStage[] = ['spec', 'implement', 'build', 'test', 'review'];

  async executeStage(input: StageInput): Promise<StageOutput> {
    const startTime = Date.now();
    const logs: string[] = [`Starting stage ${input.stage} via LocalCursorRunner (${this.id})`];

    try {
      if (!this.supportedStages.includes(input.stage)) {
        throw new Error(`Stage '${input.stage}' is not supported by runner '${this.id}'`);
      }

      // Delegate implementation/spec/review execution to runTask when available
      const agentRole = resolveAgent(input.options?.agent);
      const config: Config = resolveConfig(input.options?.config);

      const result = await runTask(config, {
        prompt: input.prompt,
        repoPath: input.repoPath,
        agent: agentRole,
        model: resolveStageModel(input.options),
      });

      const durationMs = Date.now() - startTime;
      logs.push(`Completed stage ${input.stage} in ${durationMs}ms with status: ${result.status}`);

      return {
        stage: input.stage,
        status: result.status === 'completed' || result.status === 'success' ? 'success' : 'failed',
        durationMs,
        logs,
        artifacts: result.result ? [result.result] : [],
        rawResult: result,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push(`Error executing stage ${input.stage}: ${errorMsg}`);

      return {
        stage: input.stage,
        status: 'error',
        durationMs,
        logs,
        error: errorMsg,
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const hasKey = Boolean(process.env.CURSOR_API_KEY);
    return {
      healthy: true,
      details: hasKey ? "CURSOR_API_KEY configured" : "Local Cursor SDK initialized (no CURSOR_API_KEY in env)",
    };
  }
}

export class CursorSdkRunner implements HarnessRunner {
  readonly id = "cursor-sdk";
  readonly name = "Cursor SDK Runner";
  readonly supportedStages: HarnessStage[] = ["spec", "implement", "build", "test", "review"];

  private readonly runTaskFn: RunTaskFn;

  constructor(runTaskFn: RunTaskFn = runTask) {
    this.runTaskFn = runTaskFn;
  }

  async executeStage(input: StageInput): Promise<StageOutput> {
    const startTime = Date.now();
    const logs: string[] = [`Starting stage ${input.stage} via CursorSdkRunner (${this.id})`];

    try {
      if (!this.supportedStages.includes(input.stage)) {
        throw new Error(`Stage '${input.stage}' is not supported by runner '${this.id}'`);
      }

      const agent = resolveStageAgent(input.stage, input.options);
      const prompt = wrapStagePrompt(input.stage, input.prompt);
      const timeoutMs = resolveTimeoutMs(input.options);
      const config: Config = resolveConfig(input.options?.config);

      logs.push(`Resolved agent=${agent}, timeoutMs=${timeoutMs}`);

      const runPromise = this.runTaskFn(config, {
        prompt,
        repoPath: input.repoPath,
        agent,
        model: resolveStageModel(input.options),
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const raced = await Promise.race([
          runPromise.then((r) => ({ kind: "result" as const, r })),
          new Promise<{ kind: "timeout" }>((resolve) => {
            timer = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
          }),
        ]);

        if (raced.kind === "timeout") {
          void runPromise.catch(() => {});
          const durationMs = Date.now() - startTime;
          const errorMsg = `Stage timed out after ${timeoutMs}ms`;
          logs.push(errorMsg);
          return {
            stage: input.stage,
            status: "error",
            durationMs,
            logs,
            error: errorMsg,
          };
        }

        const result = raced.r;
        const durationMs = Date.now() - startTime;
        const status = normalizeRunStatusToStageStatus(result.status);
        logs.push(`Completed stage ${input.stage} in ${durationMs}ms with status: ${result.status}`);

        return {
          stage: input.stage,
          status,
          durationMs,
          logs,
          artifacts: collectArtifacts(result),
          rawResult: result,
        };
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push(`Error executing stage ${input.stage}: ${errorMsg}`);

      return {
        stage: input.stage,
        status: "error",
        durationMs,
        logs,
        error: errorMsg,
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const hasKey = Boolean(process.env.CURSOR_API_KEY);
    return {
      healthy: true,
      details: hasKey
        ? "CURSOR_API_KEY configured"
        : "Cursor SDK Runner initialized (no CURSOR_API_KEY in env)",
    };
  }
}

export class RunnerRegistry {
  private runners = new Map<string, HarnessRunner>();
  private defaultRunnerId: string = "cursor-local";

  constructor() {
    this.register(new LocalCursorRunner());
    this.register(new CursorSdkRunner());
  }

  register(runner: HarnessRunner): void {
    if (!runner.id) {
      throw new Error("Runner must have a non-empty id");
    }
    this.runners.set(runner.id, runner);
  }

  unregister(id: string): boolean {
    if (id === this.defaultRunnerId) {
      throw new Error(`Cannot unregister default runner '${id}'`);
    }
    return this.runners.delete(id);
  }

  get(id: string): HarnessRunner | undefined {
    return this.runners.get(id);
  }

  getOrDefault(id?: string): HarnessRunner {
    if (id && this.runners.has(id)) {
      return this.runners.get(id)!;
    }
    const defaultRunner = this.runners.get(this.defaultRunnerId);
    if (!defaultRunner) {
      throw new Error(`Default runner '${this.defaultRunnerId}' is not registered`);
    }
    return defaultRunner;
  }

  setDefault(id: string): void {
    if (!this.runners.has(id)) {
      throw new Error(`Cannot set default runner to unregistered id '${id}'`);
    }
    this.defaultRunnerId = id;
  }

  getDefaultId(): string {
    return this.defaultRunnerId;
  }

  list(): HarnessRunner[] {
    return Array.from(this.runners.values());
  }
}

export const runnerRegistry = new RunnerRegistry();
