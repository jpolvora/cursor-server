import { resolveAgent } from "../agents.js";
import { loadConfig, type Config } from "../config.js";
import { runTask } from "./agent-runner.js";

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
      const config: Config = input.options?.config && typeof input.options.config === "object"
        ? Object.assign({}, loadConfig(), input.options.config)
        : loadConfig();

      const result = await runTask(config, {
        prompt: input.prompt,
        repoPath: input.repoPath,
        agent: agentRole,
        model: input.options?.model as string | undefined,
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

export class RunnerRegistry {
  private runners = new Map<string, HarnessRunner>();
  private defaultRunnerId: string = "cursor-local";

  constructor() {
    // Self-register default LocalCursorRunner
    this.register(new LocalCursorRunner());
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
