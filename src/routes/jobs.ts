import { Hono } from "hono";
import type { Config } from "../config.js";
import { getRegisteredJobs } from "../jobs/scheduler.js";
import { getJobExecutionHistory } from "../jobs/review-jobs.js";

export function createJobsRoutes(_config: Config): Hono {
  const router = new Hono();

  router.get("/", (c) => {
    const jobs = getRegisteredJobs();
    const history = getJobExecutionHistory();
    return c.json({
      jobs,
      history,
    });
  });

  router.get("/history", (c) => {
    const history = getJobExecutionHistory();
    return c.json({ history });
  });

  return router;
}
