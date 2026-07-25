import { spawn } from "node:child_process";
import {
  DEFAULT_STAGE_TIMEOUT_MS,
  resolveTimeoutMs,
  runnerRegistry,
  wrapStagePrompt,
  type HarnessRunner,
  type HarnessStage,
  type StageInput,
  type StageOutput,
} from "./harness-runner.js";

export interface OpenCodeExecRequest {
  stage: HarnessStage;
  repoPath: string;
  prompt: string;
  timeoutMs: number;
  options?: Record<string, unknown>;
}

export interface OpenCodeExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  artifacts?: string[];
  status?: "success" | "failed" | "error";
}

export type OpenCodeExecFn = (request: OpenCodeExecRequest) => Promise<OpenCodeExecResult>;

export function normalizeOpenCodeResult(
  stage: HarnessStage,
  result: OpenCodeExecResult,
  durationMs: number,
  logs: string[],
): StageOutput {
  if (result.stdout.trim()) {
    logs.push(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    logs.push(`[stderr] ${result.stderr.trim()}`);
  }

  const explicit = result.status;
  let status: StageOutput["status"];
  if (explicit === "success" || explicit === "failed" || explicit === "error") {
    status = explicit;
  } else if (result.exitCode === 0) {
    status = "success";
  } else {
    status = "failed";
  }

  const artifacts =
    result.artifacts && result.artifacts.length > 0
      ? result.artifacts
      : result.stdout.trim()
        ? [result.stdout.trim()]
        : undefined;

  const output: StageOutput = {
    stage,
    status,
    durationMs,
    logs,
    rawResult: result,
  };

  if (artifacts?.length) {
    output.artifacts = artifacts;
  }
  if (status !== "success") {
    output.error =
      result.stderr.trim() ||
      (result.stdout.trim() ? result.stdout.trim() : `OpenCode exited with code ${result.exitCode}`);
  }

  return output;
}

function execOpenCodeCli(request: OpenCodeExecRequest): Promise<OpenCodeExecResult> {
  const bin = process.env.OPENCODE_BIN?.trim() || "opencode";
  const model = request.options?.model as string | undefined;
  const args: string[] = [];

  if (model) {
    args.push("--model", model);
  }

  const engine = request.options?.engine as string | undefined;
  if (engine) {
    args.push("--engine", engine);
  }

  args.push(request.prompt);

  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env };

    const child = spawn(bin, args, {
      cwd: request.repoPath,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`OpenCode CLI timed out after ${request.timeoutMs}ms`));
    }, request.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const exitCode = code ?? 1;
      resolve({
        exitCode,
        stdout,
        stderr,
        status: exitCode === 0 ? "success" : "failed",
        artifacts: stdout.trim() ? [stdout.trim()] : [],
      });
    });
  });
}

export function createDefaultOpenCodeExec(): OpenCodeExecFn {
  return async (request) => {
    return execOpenCodeCli(request);
  };
}

export class OpenCodeRunner implements HarnessRunner {
  readonly id = "opencode";
  readonly name = "OpenCode CLI Runner";
  readonly supportedStages: HarnessStage[] = [
    "implement",
    "build",
    "test",
  ];

  private readonly openCodeExec: OpenCodeExecFn;

  constructor(openCodeExec: OpenCodeExecFn = createDefaultOpenCodeExec()) {
    this.openCodeExec = openCodeExec;
  }

  async executeStage(input: StageInput): Promise<StageOutput> {
    const startTime = Date.now();
    const logs: string[] = [
      `Starting stage ${input.stage} via OpenCodeRunner (${this.id})`,
    ];

    try {
      if (!this.supportedStages.includes(input.stage)) {
        throw new Error(
          `Stage '${input.stage}' is not supported by runner '${this.id}'`,
        );
      }

      const timeoutMs = resolveTimeoutMs(input.options);
      const prompt = wrapStagePrompt(input.stage, input.prompt);

      logs.push(`Resolved timeoutMs=${timeoutMs}`);

      const request: OpenCodeExecRequest = {
        stage: input.stage,
        repoPath: input.repoPath,
        prompt,
        timeoutMs,
        options: input.options,
      };

      const runPromise = this.openCodeExec(request);
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

        const durationMs = Date.now() - startTime;
        logs.push(`OpenCode exec finished in ${durationMs}ms`);
        return normalizeOpenCodeResult(input.stage, raced.r, durationMs, logs);
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
    const bin = process.env.OPENCODE_BIN?.trim() || "opencode";
    return {
      healthy: true,
      details: `OpenCode CLI adapter ready (bin=${bin}; live binary not required for health)`,
    };
  }
}

runnerRegistry.register(new OpenCodeRunner());

export { DEFAULT_STAGE_TIMEOUT_MS };
