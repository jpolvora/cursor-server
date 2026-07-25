import { Agent, CursorAgentError } from "@cursor/sdk";
import type { AgentId } from "../agents.js";
import type { Config } from "../config.js";

export type RunTaskInput = {
  prompt: string;
  repoPath: string;
  model?: string;
  agent: AgentId;
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
    case "default":
    default:
      return userPrompt;
  }
}

async function runAgentPhase(
  config: Config,
  input: { prompt: string; repoPath: string; model: string },
): Promise<RunPhaseResult> {
  const agent = await Agent.create({
    apiKey: config.CURSOR_API_KEY,
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
