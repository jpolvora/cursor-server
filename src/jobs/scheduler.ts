import cron from "node-cron";
import type { Config } from "../config.js";
import { createDefaultReviewJobs } from "./review-jobs.js";

export type ScheduledJob = {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
};

export type RegisteredJobInfo = {
  name: string;
  schedule: string;
  registeredAt: string;
};

export type SchedulerDeps = {
  schedule: (expression: string, func: () => void) => unknown;
};

const registeredJobs: RegisteredJobInfo[] = [];

export function getRegisteredJobs(): RegisteredJobInfo[] {
  return [...registeredJobs];
}

export function _resetRegisteredJobsForTest(): void {
  registeredJobs.length = 0;
}

const defaultSchedulerDeps: SchedulerDeps = {
  schedule: cron.schedule.bind(cron),
};

export function startScheduler(
  config: Config,
  jobs?: ScheduledJob[],
  deps: SchedulerDeps = defaultSchedulerDeps,
): void {
  const jobsToRegister = jobs ?? createDefaultReviewJobs(config);

  if (jobsToRegister.length === 0 && jobs === undefined && !config.SCHEDULED_REVIEW_JOBS) {
    console.log("[scheduler] scheduled review jobs disabled (set SCHEDULED_REVIEW_JOBS=true to enable)");
    return;
  }

  for (const job of jobsToRegister) {
    if (!cron.validate(job.schedule)) {
      throw new Error(`Invalid cron schedule for job "${job.name}": ${job.schedule}`);
    }

    deps.schedule(job.schedule, () => {
      void job.handler().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] job "${job.name}" failed: ${message}`);
      });
    });

    registeredJobs.push({
      name: job.name,
      schedule: job.schedule,
      registeredAt: new Date().toISOString(),
    });

    console.log(`[scheduler] registered job "${job.name}" (${job.schedule})`);
  }
}
