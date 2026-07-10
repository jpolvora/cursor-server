import cron from "node-cron";
import type { Config } from "../config.js";

export type ScheduledJob = {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
};

export function startScheduler(_config: Config, jobs: ScheduledJob[] = []): void {
  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      throw new Error(`Invalid cron schedule for job "${job.name}": ${job.schedule}`);
    }

    cron.schedule(job.schedule, () => {
      void job.handler().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] job "${job.name}" failed: ${message}`);
      });
    });

    console.log(`[scheduler] registered job "${job.name}" (${job.schedule})`);
  }
}
