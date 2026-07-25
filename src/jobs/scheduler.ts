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

const registeredJobs: RegisteredJobInfo[] = [];

export function getRegisteredJobs(): RegisteredJobInfo[] {
  return [...registeredJobs];
}

export function startScheduler(config: Config, jobs?: ScheduledJob[]): void {
  const jobsToRegister = jobs ?? createDefaultReviewJobs(config);

  for (const job of jobsToRegister) {
    if (!cron.validate(job.schedule)) {
      throw new Error(`Invalid cron schedule for job "${job.name}": ${job.schedule}`);
    }

    cron.schedule(job.schedule, () => {
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
