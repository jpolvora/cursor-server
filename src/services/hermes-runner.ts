import { execFile, spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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

export interface HermesExecRequest {
  stage: HarnessStage;
  repoPath: string;
  prompt: string;
  skills: string[];
  timeoutMs: number;
  options?: Record<string, unknown>;
}

export interface HermesExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  skillsLoaded?: string[];
  artifacts?: string[];
  status?: "success" | "failed" | "error";
}

export type HermesExecFn = (request: HermesExecRequest) => Promise<HermesExecResult>;

const DEFAULT_STAGE_SKILLS: Partial<Record<HarnessStage, string[]>> = {
  spec: ["planning"],
  implement: ["coding"],
  build: ["build"],
  test: ["testing"],
  review: ["review"],
};

export function resolveHermesSkills(
  stage: HarnessStage,
  options?: Record<string, unknown>,
): string[] {
  const raw = options?.skills;
  if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) {
    return raw.filter((s) => s.trim() !== "");
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_STAGE_SKILLS[stage] ?? [];
}

export function normalizeHermesResult(
  stage: HarnessStage,
  result: HermesExecResult,
  durationMs: number,
  logs: string[],
): StageOutput {
  if (result.skillsLoaded?.length) {
    logs.push(`Skills loaded: ${result.skillsLoaded.join(", ")}`);
  }

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
      (result.stdout.trim() ? result.stdout.trim() : `Hermes exited with code ${result.exitCode}`);
  }

  return output;
}

async function execHermesHttp(
  apiUrl: string,
  request: HermesExecRequest,
): Promise<HermesExecResult> {
  const base = apiUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.HERMES_API_KEY
          ? { authorization: `Bearer ${process.env.HERMES_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: [
          {
            role: "user",
            content: [
              `Working directory: ${request.repoPath}`,
              request.skills.length
                ? `Load skills: ${request.skills.join(", ")}`
                : null,
              request.prompt,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let content = text;
    try {
      const json = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = json.choices?.[0]?.message?.content ?? text;
    } catch {
      // keep raw text
    }

    return {
      exitCode: res.ok ? 0 : res.status,
      stdout: content,
      stderr: res.ok ? "" : `HTTP ${res.status}`,
      skillsLoaded: request.skills,
      status: res.ok ? "success" : "failed",
      artifacts: content.trim() ? [content.trim()] : [],
    };
  } finally {
    clearTimeout(timer);
  }
}

const execFileAsync = promisify(execFile);

export function resolveHermesBin(): string {
  return process.env.HERMES_BIN?.trim() || "hermes";
}

export function buildHermesCliArgs(
  request: Pick<HermesExecRequest, "prompt" | "skills">,
): string[] {
  const args = ["chat", "-q", request.prompt];
  if (request.skills.length) {
    args.push("-s", request.skills.join(","));
  }
  return args;
}

export async function isHermesCliResolvable(bin: string): Promise<boolean> {
  const trimmed = bin.trim();
  if (!trimmed) return false;

  if (
    path.isAbsolute(trimmed) ||
    trimmed.includes(path.sep) ||
    trimmed.includes("/")
  ) {
    try {
      await access(trimmed, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    await execFileAsync(whichCmd, [trimmed]);
    return true;
  } catch {
    return false;
  }
}

function execHermesCli(request: HermesExecRequest): Promise<HermesExecResult> {
  const bin = resolveHermesBin();
  const args = buildHermesCliArgs(request);

  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (request.skills.length) {
      env.HERMES_SKILLS = request.skills.join(",");
    }

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
      reject(new Error(`Hermes CLI timed out after ${request.timeoutMs}ms`));
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
        skillsLoaded: request.skills,
        status: exitCode === 0 ? "success" : "failed",
        artifacts: stdout.trim() ? [stdout.trim()] : [],
      });
    });
  });
}

export function createDefaultHermesExec(): HermesExecFn {
  return async (request) => {
    const apiUrl = process.env.HERMES_API_URL?.trim();
    if (apiUrl) {
      return execHermesHttp(apiUrl, request);
    }
    return execHermesCli(request);
  };
}

export class HermesRunner implements HarnessRunner {
  readonly id = "hermes";
  readonly name = "Hermes Agent Runner";
  readonly supportedStages: HarnessStage[] = [
    "spec",
    "implement",
    "build",
    "test",
    "review",
  ];

  private readonly hermesExec: HermesExecFn;

  constructor(hermesExec: HermesExecFn = createDefaultHermesExec()) {
    this.hermesExec = hermesExec;
  }

  async executeStage(input: StageInput): Promise<StageOutput> {
    const startTime = Date.now();
    const logs: string[] = [
      `Starting stage ${input.stage} via HermesRunner (${this.id})`,
    ];

    try {
      if (!this.supportedStages.includes(input.stage)) {
        throw new Error(
          `Stage '${input.stage}' is not supported by runner '${this.id}'`,
        );
      }

      const skills = resolveHermesSkills(input.stage, input.options);
      const timeoutMs = resolveTimeoutMs(input.options);
      const prompt = wrapStagePrompt(input.stage, input.prompt);

      logs.push(
        `Resolved timeoutMs=${timeoutMs}, skills=${skills.length ? skills.join(",") : "(none)"}`,
      );

      const request: HermesExecRequest = {
        stage: input.stage,
        repoPath: input.repoPath,
        prompt,
        skills,
        timeoutMs,
        options: input.options,
      };

      const runPromise = this.hermesExec(request);
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
        logs.push(`Hermes exec finished in ${durationMs}ms`);
        return normalizeHermesResult(input.stage, raced.r, durationMs, logs);
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
    const apiUrl = process.env.HERMES_API_URL?.trim();
    if (apiUrl) {
      return {
        healthy: true,
        details: `HERMES_API_URL configured (${apiUrl})`,
      };
    }

    const bin = resolveHermesBin();
    const cliAvailable = await isHermesCliResolvable(bin);
    if (!cliAvailable) {
      return {
        healthy: false,
        details: `Hermes CLI not found (bin=${bin}); set HERMES_BIN or HERMES_API_URL`,
      };
    }

    return {
      healthy: true,
      details: `Hermes CLI available (bin=${bin})`,
    };
  }
}

/** Register hermes after harness-runner module finished init (avoids circular ctor TDZ). */
runnerRegistry.register(new HermesRunner());

export { DEFAULT_STAGE_TIMEOUT_MS };
