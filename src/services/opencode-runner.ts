import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  DEFAULT_STAGE_TIMEOUT_MS,
  resolveStageLogSink,
  resolveTimeoutMs,
  runnerRegistry,
  wrapStagePrompt,
  type HarnessRunner,
  type HarnessStage,
  type StageInput,
  type StageLogSink,
  type StageOutput,
} from "./harness-runner.js";

export interface OpenCodeExecRequest {
  stage: HarnessStage;
  repoPath: string;
  prompt: string;
  timeoutMs: number;
  options?: Record<string, unknown>;
  onLog?: StageLogSink;
}

export interface OpenCodeExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  artifacts?: string[];
  status?: "success" | "failed" | "error";
  gitStatusPorcelain?: string;
}

export type OpenCodeExecFn = (request: OpenCodeExecRequest) => Promise<OpenCodeExecResult>;

const execFileAsync = promisify(execFile);

function forwardStreamChunk(
  chunk: Buffer | string,
  stream: "stdout" | "stderr",
  buffer: { value: string },
  onLog?: StageLogSink,
): void {
  const text = String(chunk);
  buffer.value += text;
  if (!onLog || text.length === 0) return;
  onLog(stream === "stderr" ? `[stderr] ${text}` : text);
}

export async function captureGitStatusPorcelain(
  repoPath: string,
): Promise<{ porcelain?: string; skippedReason?: string }> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd: repoPath,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { porcelain: stdout };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { skippedReason: "git command not found" };
    }
    if (
      msg.includes("not a git repository") ||
      msg.includes("Not a git repository")
    ) {
      return { skippedReason: "not a git repository" };
    }
    return { skippedReason: `git status failed: ${msg}` };
  }
}

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

  const artifacts: string[] = [];
  if (result.artifacts && result.artifacts.length > 0) {
    artifacts.push(...result.artifacts);
  } else if (result.stdout.trim()) {
    artifacts.push(result.stdout.trim());
  }
  if (result.gitStatusPorcelain !== undefined) {
    artifacts.push(`git-status:\n${result.gitStatusPorcelain}`);
  }

  const output: StageOutput = {
    stage,
    status,
    durationMs,
    logs,
    rawResult: result,
  };

  if (artifacts.length > 0) {
    output.artifacts = artifacts;
  }
  if (status !== "success") {
    output.error =
      result.stderr.trim() ||
      (result.stdout.trim() ? result.stdout.trim() : `OpenCode exited with code ${result.exitCode}`);
  }

  return output;
}

export function execOpenCodeCli(
  request: OpenCodeExecRequest,
  spawnImpl: typeof spawn = spawn,
): Promise<OpenCodeExecResult> {
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

    const child = spawnImpl(bin, args, {
      cwd: request.repoPath,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout = { value: "" };
    const stderr = { value: "" };
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`OpenCode CLI timed out after ${request.timeoutMs}ms`));
    }, request.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      forwardStreamChunk(chunk, "stdout", stdout, request.onLog);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      forwardStreamChunk(chunk, "stderr", stderr, request.onLog);
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
        stdout: stdout.value,
        stderr: stderr.value,
        status: exitCode === 0 ? "success" : "failed",
        artifacts: stdout.value.trim() ? [stdout.value.trim()] : [],
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
      const onLog = resolveStageLogSink(input.options);
      const prompt = wrapStagePrompt(input.stage, input.prompt);

      logs.push(`Resolved timeoutMs=${timeoutMs}`);

      const request: OpenCodeExecRequest = {
        stage: input.stage,
        repoPath: input.repoPath,
        prompt,
        timeoutMs,
        options: input.options,
        onLog,
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

        const git = await captureGitStatusPorcelain(input.repoPath);
        if (git.porcelain !== undefined) {
          raced.r.gitStatusPorcelain = git.porcelain;
        } else if (git.skippedReason) {
          logs.push(`Git status skipped: ${git.skippedReason}`);
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
