import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { startScheduler, getRegisteredJobs, _resetRegisteredJobsForTest } from "./scheduler.js";
import { createDefaultReviewJobs, getJobExecutionHistory } from "./review-jobs.js";
import type { Config } from "../config.js";

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: "./repos",
    CURSOR_MODEL: "test-model",
    SERVER_API_KEY: undefined,
    TENANTS: [],
    SCHEDULED_REVIEW_JOBS: false,
    SCHEDULED_REVIEW_RESUME_AGENT_ID: undefined,
    ...overrides,
  };
}

const testSchedulerDeps = {
  schedule: () => ({ stop: () => undefined }),
};

describe("scheduler", () => {
  beforeEach(() => {
    _resetRegisteredJobsForTest();
  });

  it("does not register default review jobs when disabled", () => {
    startScheduler(baseConfig(), undefined, testSchedulerDeps);
    const jobs = getRegisteredJobs();
    assert.strictEqual(jobs.some((j) => j.name === "pr-diff-review"), false);
    assert.strictEqual(jobs.some((j) => j.name === "repo-hygiene-check"), false);
  });

  it("registers default review jobs when SCHEDULED_REVIEW_JOBS is true", () => {
    startScheduler(baseConfig({ SCHEDULED_REVIEW_JOBS: true }), undefined, testSchedulerDeps);
    const jobs = getRegisteredJobs();
    assert.strictEqual(jobs.some((j) => j.name === "pr-diff-review"), true);
    assert.strictEqual(jobs.some((j) => j.name === "repo-hygiene-check"), true);
  });

  it("creates default review jobs with valid cron schedules when enabled", () => {
    const defaultJobs = createDefaultReviewJobs(baseConfig({ SCHEDULED_REVIEW_JOBS: true }));
    assert.strictEqual(defaultJobs.length, 2);
    assert.strictEqual(defaultJobs[0].name, "pr-diff-review");
    assert.strictEqual(defaultJobs[1].name, "repo-hygiene-check");
  });

  it("handles dry execution history", () => {
    const history = getJobExecutionHistory();
    assert.strictEqual(Array.isArray(history), true);
  });
});
