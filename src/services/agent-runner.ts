import { Agent, CursorAgentError } from "@cursor/sdk";
import type { Config } from "../config.js";

export type RunTaskInput = {
  prompt: string;
  repoPath: string;
  model?: string;
};

export type RunTaskResult = {
  agentId: string;
  runId: string;
  status: string;
  durationMs?: number;
  result?: string;
};

export async function runTask(
  config: Config,
  input: RunTaskInput,
): Promise<RunTaskResult> {
  const agent = await Agent.create({
    apiKey: config.CURSOR_API_KEY,
    model: { id: input.model ?? config.CURSOR_MODEL },
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
