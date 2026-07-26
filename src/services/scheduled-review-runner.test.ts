import { describe, it } from "node:test";
import assert from "node:assert";
import type { Config } from "../config.js";
import {
  runScheduledReview,
  type ScheduledReviewAgent,
  type ScheduledReviewAgentFactory,
} from "./scheduled-review-runner.js";

const mockConfig: Config = {
  CURSOR_API_KEY: "test-key",
  PORT: 3000,
  HOST: "0.0.0.0",
  REPOS_ROOT: "./repos",
  CURSOR_MODEL: "composer-2",
  SERVER_API_KEY: undefined,
  TENANTS: [],
  SCHEDULED_REVIEW_JOBS: false,
  SCHEDULED_REVIEW_RESUME_AGENT_ID: undefined,
};

function createMockAgent(agentId: string): ScheduledReviewAgent {
  return {
    agentId,
    async send() {
      return {
        async wait() {
          return {
            id: "run-1",
            status: "finished",
            durationMs: 42,
            result: "review complete",
          };
        },
      };
    },
    async [Symbol.asyncDispose]() {},
  };
}

describe("scheduled-review-runner", () => {
  it("uses Agent.create when resumeAgentId is not provided", async () => {
    let createCalled = false;
    let resumeCalled = false;
    let createOptions: unknown;

    const factory: ScheduledReviewAgentFactory = {
      create: async (options) => {
        createCalled = true;
        createOptions = options;
        return createMockAgent("agent-new");
      },
      resume: async () => {
        resumeCalled = true;
        return createMockAgent("agent-resumed");
      },
    };

    const result = await runScheduledReview(
      mockConfig,
      {
        prompt: "review",
        repoPath: "/tmp/repo",
      },
      factory,
    );

    assert.strictEqual(createCalled, true);
    assert.strictEqual(resumeCalled, false);
    assert.strictEqual(result.agentId, "agent-new");
    assert.strictEqual(result.resumed, false);
    assert.strictEqual(result.status, "finished");
    assert.deepStrictEqual(
      (createOptions as { local?: { cwd?: string; settingSources?: unknown[] } }).local,
      { cwd: "/tmp/repo", settingSources: [] },
    );
  });

  it("uses Agent.resume when resumeAgentId is provided", async () => {
    let createCalled = false;
    let resumeCalled = false;
    let resumedId: string | undefined;
    let resumeOptions: unknown;

    const factory: ScheduledReviewAgentFactory = {
      create: async () => {
        createCalled = true;
        return createMockAgent("agent-new");
      },
      resume: async (agentId, options) => {
        resumeCalled = true;
        resumedId = agentId;
        resumeOptions = options;
        return createMockAgent(agentId);
      },
    };

    const result = await runScheduledReview(
      mockConfig,
      {
        prompt: "continue review",
        repoPath: "/tmp/repo",
        resumeAgentId: "agent-existing-99",
      },
      factory,
    );

    assert.strictEqual(createCalled, false);
    assert.strictEqual(resumeCalled, true);
    assert.strictEqual(resumedId, "agent-existing-99");
    assert.strictEqual(result.agentId, "agent-existing-99");
    assert.strictEqual(result.resumed, true);
    assert.deepStrictEqual(
      (resumeOptions as { local?: { cwd?: string; settingSources?: unknown[] } }).local,
      { cwd: "/tmp/repo", settingSources: [] },
    );
  });
});
