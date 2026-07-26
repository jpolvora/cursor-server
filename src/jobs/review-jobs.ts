import fs from "node:fs";
import path from "node:path";
import type { Config } from "../config.js";
import type { ScheduledJob } from "./scheduler.js";
import { runScheduledReview } from "../services/scheduled-review-runner.js";
import {
  formatHygieneFindings,
  listReposUnderRoot,
  scanRepoHygiene,
} from "../services/repo-hygiene.js";

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

export function _resetJobExecutionHistoryForTest(): void {
  executionHistory.length = 0;
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

export type ReviewJobOptions = {
  resumeAgentId?: string;
};

function resolveResumeAgentId(config: Config, options?: ReviewJobOptions): string | undefined {
  return options?.resumeAgentId ?? config.SCHEDULED_REVIEW_RESUME_AGENT_ID;
}

export function createPrDiffReviewJob(config: Config, options?: ReviewJobOptions): ScheduledJob {
  return {
    name: "pr-diff-review",
    schedule: "0 */6 * * *",
    handler: async () => {
      console.log("[review-job:pr-diff-review] Starting automated PR diff review job...");
      const started = Date.now();
      const resumeAgentId = resolveResumeAgentId(config, options);

      if (!fs.existsSync(config.REPOS_ROOT)) {
        recordJobExecution({
          jobName: "pr-diff-review",
          status: "skipped",
          details: `REPOS_ROOT directory '${config.REPOS_ROOT}' does not exist`,
        });
        return;
      }

      const repos = listReposUnderRoot(config.REPOS_ROOT);

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
            prompt:
              "Perform a PR diff review and branch synchronization check on the current working tree. Report any uncommitted changes, merge conflicts, or code issues.",
            repoPath,
            resumeAgentId,
          });

          recordJobExecution({
            jobName: "pr-diff-review",
            status: reviewResult.status === "error" ? "error" : "success",
            details: `Completed review for ${repo}${reviewResult.resumed ? " (resumed agent)" : ""}: ${reviewResult.result?.slice(0, 100) ?? reviewResult.status}`,
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
    schedule: "0 0 * * *",
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

      const repos = listReposUnderRoot(config.REPOS_ROOT);

      if (repos.length === 0) {
        recordJobExecution({
          jobName: "repo-hygiene-check",
          status: "skipped",
          details: "No repositories found under REPOS_ROOT",
        });
        return;
      }

      for (const repo of repos) {
        const repoPath = path.join(config.REPOS_ROOT, repo);
        try {
          const scan = await scanRepoHygiene(repoPath, repo);
          const hasErrors = scan.issues.some((issue) => issue.kind === "scan_error");

          recordJobExecution({
            jobName: "repo-hygiene-check",
            status: hasErrors ? "error" : "success",
            details: formatHygieneFindings(scan),
            durationMs: Date.now() - started,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          recordJobExecution({
            jobName: "repo-hygiene-check",
            status: "error",
            details: `Failed hygiene scan for ${repo}: ${msg}`,
            durationMs: Date.now() - started,
          });
        }
      }
    },
  };
}

export function createDefaultReviewJobs(config: Config): ScheduledJob[] {
  if (!config.SCHEDULED_REVIEW_JOBS) {
    return [];
  }

  return [createPrDiffReviewJob(config), createRepoHygieneJob(config)];
}
