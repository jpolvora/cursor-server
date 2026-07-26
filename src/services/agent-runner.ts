import { Agent, CursorAgentError } from "@cursor/sdk";
import type { AgentId } from "../agents.js";
import type { Config } from "../config.js";

export type RunTaskInput = {
  prompt: string;
  repoPath: string;
  model?: string;
  agent: AgentId;
  tenantId?: string;
  allowedRepos?: string[];
};

export type RunPhaseResult = {
  agentId: string;
  runId: string;
  status: string;
  durationMs?: number;
  result?: string;
  model: string;
};

export type RunTaskResult = {
  agent: AgentId;
  status: string;
  durationMs: number;
  /** Present when agent is `plan+implementer`. */
  plan?: RunPhaseResult;
  /** Primary / implement phase (or sole phase for default|planner|implementer). */
  run: RunPhaseResult;
  /** Convenience: last phase result text. */
  result?: string;
};

function buildPlanPrompt(userPrompt: string): string {
  return [
    "You are planning only. Do not implement or edit files.",
    "Produce a concrete, actionable implementation plan for the following task.",
    "Include: goal, key files/areas to touch, ordered steps, risks, and acceptance checks.",
    "",
    "Task:",
    userPrompt,
  ].join("\n");
}

function buildImplementPrompt(userPrompt: string, planText?: string): string {
  if (!planText) {
    return [
      "Implement the following task. Make the necessary code changes.",
      "",
      "Task:",
      userPrompt,
    ].join("\n");
  }

  return [
    "Execute the following task using the plan below.",
    "Follow the plan unless you discover a blocking issue; if so, note the deviation briefly.",
    "",
    "## Plan",
    planText,
    "",
    "## Task",
    userPrompt,
  ].join("\n");
}

function buildSpecToPrPrompt(userPrompt: string, lite: boolean = false): string {
  const skillPath = lite
    ? ".agents/skills/spec-to-pr-lite/SKILL.md"
    : ".agents/skills/spec-to-pr/SKILL.md";
  const flowName = lite ? "Spec-to-PR Lite" : "Spec-to-PR";

  return [
    `You are operating as a dedicated ${flowName} agent workflow runner.`,
    `First, inspect and read instructions in \`${skillPath}\` if present in the working tree or customization roots.`,
    `Follow the ${flowName} workflow steps strictly to turn the following task/specification into completed, verified work.`,
    "",
    "## Task / Spec:",
    userPrompt,
  ].join("\n");
}

function promptForAgent(agent: AgentId, userPrompt: string, planText?: string): string {
  switch (agent) {
    case "planner":
      return buildPlanPrompt(userPrompt);
    case "implementer":
      return buildImplementPrompt(userPrompt);
    case "plan+implementer":
      return planText
        ? buildImplementPrompt(userPrompt, planText)
        : buildPlanPrompt(userPrompt);
    case "spec-to-pr":
      return buildSpecToPrPrompt(userPrompt, false);
    case "spec-to-pr-lite":
      return buildSpecToPrPrompt(userPrompt, true);
    case "default":
    default:
      return userPrompt;
  }
}

export interface ResourceLimits {
  cpuQuota?: number;
  memoryLimitMb?: number;
}

export function parseResourceLimits(_config: Config): ResourceLimits {
  const cpuQuota = process.env.TENANT_CPU_QUOTA ? Number(process.env.TENANT_CPU_QUOTA) : undefined;
  const memoryLimitMb = process.env.TENANT_MEMORY_LIMIT_MB ? Number(process.env.TENANT_MEMORY_LIMIT_MB) : undefined;
  return { cpuQuota, memoryLimitMb };
}

function applyTenantEnv(input: { tenantId?: string; repoPath: string }) {
  if (input.tenantId) {
    process.env.CURSOR_TENANT_ID = input.tenantId;
    process.env.CURSOR_TENANT_REPO_PATH = input.repoPath;
  }
}

async function runAgentPhase(
  _config: Config,
  input: { prompt: string; repoPath: string; model: string; tenantId?: string; allowedRepos?: string[] },
): Promise<RunPhaseResult> {
  applyTenantEnv(input);

  const agent = await Agent.create({
    apiKey: _config.CURSOR_API_KEY,
    model: { id: input.model },
    local: {
      cwd: input.repoPath,
      settingSources: [],
    },
  });

  try {
    const run = await agent.send(input.prompt);
    const result = await run.wait();

    return {
      agentId: agent.agentId,
      runId: result.id,
      status: result.status,
      durationMs: result.durationMs,
      result: result.result,
      model: input.model,
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Agent startup failed: ${err.message}`, { cause: err });
    }
    throw err;
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

export async function runTask(
  config: Config,
  input: RunTaskInput,
): Promise<RunTaskResult> {
  const model = input.model ?? config.CURSOR_MODEL;
  const started = Date.now();
  const agent = input.agent;

  if (agent === "plan+implementer") {
    const plan = await runAgentPhase(config, {
      prompt: promptForAgent("planner", input.prompt),
      repoPath: input.repoPath,
      model,
    });

    if (plan.status === "error") {
      return {
        agent,
        status: "error",
        durationMs: Date.now() - started,
        plan,
        run: {
          agentId: "",
          runId: "",
          status: "skipped",
          model,
        },
        result: plan.result,
      };
    }

    const run = await runAgentPhase(config, {
      prompt: promptForAgent("plan+implementer", input.prompt, plan.result),
      repoPath: input.repoPath,
      model,
    });

    return {
      agent,
      status: run.status,
      durationMs: Date.now() - started,
      plan,
      run,
      result: run.result,
    };
  }

  const run = await runAgentPhase(config, {
    prompt: promptForAgent(agent, input.prompt),
    repoPath: input.repoPath,
    model,
  });

  return {
    agent,
    status: run.status,
    durationMs: Date.now() - started,
    run,
    result: run.result,
  };
}
