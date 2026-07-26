import { Agent, CursorAgentError } from "@cursor/sdk";
import type { Config } from "../config.js";

export type ScheduledReviewInput = {
  prompt: string;
  repoPath: string;
  model?: string;
  /** When set, resumes an existing Cursor agent via Agent.resume instead of Agent.create. */
  resumeAgentId?: string;
};

export type ScheduledReviewResult = {
  agentId: string;
  runId: string;
  status: string;
  durationMs?: number;
  result?: string;
  model: string;
  resumed: boolean;
};

export type ScheduledReviewAgent = {
  agentId: string;
  send: (prompt: string) => Promise<{
    wait: () => Promise<{ id: string; status: string; durationMs?: number; result?: string }>;
  }>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export type ScheduledReviewAgentFactory = {
  create: (options: unknown) => Promise<ScheduledReviewAgent>;
  resume: (agentId: string, options: unknown) => Promise<ScheduledReviewAgent>;
};

const defaultAgentFactory: ScheduledReviewAgentFactory = {
  create: Agent.create.bind(Agent) as ScheduledReviewAgentFactory["create"],
  resume: Agent.resume.bind(Agent) as ScheduledReviewAgentFactory["resume"],
};

export async function runScheduledReview(
  config: Config,
  input: ScheduledReviewInput,
  agentFactory: ScheduledReviewAgentFactory = defaultAgentFactory,
): Promise<ScheduledReviewResult> {
  const model = input.model ?? config.CURSOR_MODEL;
  const isResume = Boolean(input.resumeAgentId);
  const runtimeOptions = {
    apiKey: config.CURSOR_API_KEY,
    model: { id: model },
    local: {
      cwd: input.repoPath,
      settingSources: [] as const,
    },
  };

  const agent = input.resumeAgentId
    ? await agentFactory.resume(input.resumeAgentId, runtimeOptions)
    : await agentFactory.create(runtimeOptions);

  try {
    const run = await agent.send(input.prompt);
    const result = await run.wait();

    return {
      agentId: agent.agentId,
      runId: result.id,
      status: result.status,
      durationMs: result.durationMs,
      result: result.result,
      model,
      resumed: isResume,
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Scheduled agent execution failed: ${err.message}`, { cause: err });
    }
    throw err;
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}
