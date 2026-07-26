import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  createDefaultReviewJobs,
  createRepoHygieneJob,
  getJobExecutionHistory,
  _resetJobExecutionHistoryForTest,
} from "./review-jobs.js";
import type { Config } from "../config.js";

const execFileAsync = promisify(execFile);

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

describe("review-jobs", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    _resetJobExecutionHistoryForTest();
  });

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("returns no default jobs when SCHEDULED_REVIEW_JOBS is false", () => {
    const jobs = createDefaultReviewJobs(baseConfig());
    assert.strictEqual(jobs.length, 0);
  });

  it("returns built-in jobs when SCHEDULED_REVIEW_JOBS is true", () => {
    const jobs = createDefaultReviewJobs(baseConfig({ SCHEDULED_REVIEW_JOBS: true }));
    assert.strictEqual(jobs.length, 2);
    assert.strictEqual(jobs[0]?.name, "pr-diff-review");
    assert.strictEqual(jobs[1]?.name, "repo-hygiene-check");
  });

  it("records hygiene findings for dirty worktrees", async () => {
    const reposRoot = await mkdtemp(path.join(os.tmpdir(), "hygiene-repos-"));
    tempDirs.push(reposRoot);
    const repoPath = path.join(reposRoot, "dirty-repo");
    await mkdir(repoPath, { recursive: true });
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "dirty.txt"), "pending change");

    const job = createRepoHygieneJob(baseConfig({ REPOS_ROOT: reposRoot }));
    await job.handler();

    const history = getJobExecutionHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0]?.jobName, "repo-hygiene-check");
    assert.strictEqual(history[0]?.status, "success");
    assert.match(history[0]?.details ?? "", /dirty_worktree/);
    assert.match(history[0]?.details ?? "", /dirty-repo/);
  });

  it("records hygiene scan for committed repo without dirty worktree", async () => {
    const reposRoot = await mkdtemp(path.join(os.tmpdir(), "hygiene-clean-"));
    tempDirs.push(reposRoot);
    const repoPath = path.join(reposRoot, "clean-repo");
    await mkdir(repoPath, { recursive: true });
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "tracked.txt"), "hello");
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoPath });

    const job = createRepoHygieneJob(baseConfig({ REPOS_ROOT: reposRoot }));
    await job.handler();

    const history = getJobExecutionHistory();
    assert.strictEqual(history.length, 1);
    assert.match(history[0]?.details ?? "", /clean-repo/);
    assert.doesNotMatch(history[0]?.details ?? "", /dirty_worktree/);
  });

  it("skips hygiene job when REPOS_ROOT is empty", async () => {
    const reposRoot = await mkdtemp(path.join(os.tmpdir(), "hygiene-empty-"));
    tempDirs.push(reposRoot);
    const job = createRepoHygieneJob(baseConfig({ REPOS_ROOT: reposRoot }));
    await job.handler();

    const history = getJobExecutionHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0]?.status, "skipped");
    assert.match(history[0]?.details ?? "", /No repositories found/);
  });
});
