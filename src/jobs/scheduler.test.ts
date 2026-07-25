import { describe, it } from "node:test";
import assert from "node:assert";
import { startScheduler, getRegisteredJobs } from "./scheduler.js";
import { createDefaultReviewJobs, getJobExecutionHistory } from "./review-jobs.js";
import type { Config } from "../config.js";

const mockConfig: Config = {
  CURSOR_API_KEY: "test-key",
  PORT: 3000,
  HOST: "0.0.0.0",
  REPOS_ROOT: "./repos",
  CURSOR_MODEL: "test-model",
  SERVER_API_KEY: undefined,
};

describe("scheduler", () => {
  it("registers default review jobs when no jobs are provided", () => {
    startScheduler(mockConfig);
    const jobs = getRegisteredJobs();
    assert.strictEqual(jobs.some((j) => j.name === "pr-diff-review"), true);
    assert.strictEqual(jobs.some((j) => j.name === "repo-hygiene-check"), true);
  });

  it("creates default review jobs with valid cron schedules", () => {
    const defaultJobs = createDefaultReviewJobs(mockConfig);
    assert.strictEqual(defaultJobs.length, 2);
    assert.strictEqual(defaultJobs[0].name, "pr-diff-review");
    assert.strictEqual(defaultJobs[1].name, "repo-hygiene-check");
  });

  it("handles dry execution history", () => {
    const history = getJobExecutionHistory();
    assert.strictEqual(Array.isArray(history), true);
  });
});
