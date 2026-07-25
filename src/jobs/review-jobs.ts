import fs from "node:fs";
import path from "node:path";
import type { Config } from "../config.js";
import type { ScheduledJob } from "./scheduler.js";
import { runScheduledReview } from "../services/scheduled-review-runner.js";

export type ReviewJobExecutionRecord = {
  id: string;
  jobName: string;
  timestamp: string;
  status: "success" | "error" | "skipped";
  details: string;
  durationMs?: number;
};

const executionHistory: ReviewJobExecutionRecord[] = [];
const MAX_HISTORY = 50;

export function getJobExecutionHistory(): ReviewJobExecutionRecord[] {
  return [...executionHistory];
}

export function recordJobExecution(record: Omit<ReviewJobExecutionRecord, "id" | "timestamp">): ReviewJobExecutionRecord {
  const entry: ReviewJobExecutionRecord = {
    ...record,
    id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  executionHistory.unshift(entry);
  if (executionHistory.length > MAX_HISTORY) {
    executionHistory.pop();
  }

  return entry;
}

export function createPrDiffReviewJob(config: Config): ScheduledJob {
  return {
    name: "pr-diff-review",
    schedule: "0 */6 * * *", // every 6 hours by default
    handler: async () => {
      console.log("[review-job:pr-diff-review] Starting automated PR diff review job...");
      const started = Date.now();

      if (!fs.existsSync(config.REPOS_ROOT)) {
        recordJobExecution({
          jobName: "pr-diff-review",
          status: "skipped",
          details: `REPOS_ROOT directory '${config.REPOS_ROOT}' does not exist`,
        });
        return;
      }

      const repos = fs.readdirSync(config.REPOS_ROOT).filter((entry) => {
        const full = path.join(config.REPOS_ROOT, entry);
        return fs.statSync(full).isDirectory();
      });

      if (repos.length === 0) {
        recordJobExecution({
          jobName: "pr-diff-review",
          status: "skipped",
          details: "No repositories found under REPOS_ROOT",
        });
        return;
      }

      for (const repo of repos) {
        const repoPath = path.join(config.REPOS_ROOT, repo);
        try {
          const reviewResult = await runScheduledReview(config, {
            prompt: "Perform a PR diff review and branch synchronization check on the current working tree. Report any uncommitted changes, merge conflicts, or code issues.",
            repoPath,
          });

          recordJobExecution({
            jobName: "pr-diff-review",
            status: reviewResult.status === "error" ? "error" : "success",
            details: `Completed review for ${repo}: ${reviewResult.result?.slice(0, 100) ?? reviewResult.status}`,
            durationMs: Date.now() - started,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          recordJobExecution({
            jobName: "pr-diff-review",
            status: "error",
            details: `Failed review for ${repo}: ${msg}`,
            durationMs: Date.now() - started,
          });
        }
      }
    },
  };
}

export function createRepoHygieneJob(config: Config): ScheduledJob {
  return {
    name: "repo-hygiene-check",
    schedule: "0 0 * * *", // daily at midnight
    handler: async () => {
      console.log("[review-job:repo-hygiene-check] Starting repo hygiene check job...");
      const started = Date.now();

      if (!fs.existsSync(config.REPOS_ROOT)) {
        recordJobExecution({
          jobName: "repo-hygiene-check",
          status: "skipped",
          details: `REPOS_ROOT directory '${config.REPOS_ROOT}' does not exist`,
        });
        return;
      }

      recordJobExecution({
        jobName: "repo-hygiene-check",
        status: "skipped",
        details: "Placeholder: hygiene scanning not yet implemented.",
        durationMs: Date.now() - started,
      });
    },
  };
}

export function createDefaultReviewJobs(config: Config): ScheduledJob[] {
  return [
    createPrDiffReviewJob(config),
    createRepoHygieneJob(config),
  ];
}
