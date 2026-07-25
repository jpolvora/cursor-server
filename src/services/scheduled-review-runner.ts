import { Agent, CursorAgentError } from "@cursor/sdk";
import type { Config } from "../config.js";

export type ScheduledReviewInput = {
  prompt: string;
  repoPath: string;
  model?: string;
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

export async function runScheduledReview(
  config: Config,
  input: ScheduledReviewInput,
): Promise<ScheduledReviewResult> {
  const model = input.model ?? config.CURSOR_MODEL;
  const isResume = Boolean(input.resumeAgentId);

  const agent = input.resumeAgentId
    ? await Agent.resume(input.resumeAgentId, {
        apiKey: config.CURSOR_API_KEY,
        model: { id: model },
        local: {
          cwd: input.repoPath,
          settingSources: [],
        },
      })
    : await Agent.create({
        apiKey: config.CURSOR_API_KEY,
        model: { id: model },
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
