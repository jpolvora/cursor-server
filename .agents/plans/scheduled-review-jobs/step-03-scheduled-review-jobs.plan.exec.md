# Execution Plan — scheduled-review-jobs

`execMode: sequential`

## Implementation Steps

1. **Step 1: Scheduled Review Runner Service**
   - File: `src/services/scheduled-review-runner.ts`
   - Description: Implement `ScheduledReviewRunner` to execute local agent review tasks and support `Agent.resume`.

2. **Step 2: Review Job Definitions & Scheduler Update**
   - Files: `src/jobs/review-jobs.ts`, `src/jobs/scheduler.ts`
   - Description: Implement built-in review job handlers (`pr-diff-review`, `repo-hygiene-check`) and integrate into `startScheduler`.

3. **Step 3: Jobs Route & Server Wiring**
   - Files: `src/routes/jobs.ts`, `src/index.ts`
   - Description: Create `GET /jobs` status endpoint and wire into main Hono server.

4. **Step 4: Verification & Typecheck**
   - Files: `src/jobs/scheduler.test.ts` (if applicable)
   - Description: Verify build and typecheck with `npm run build` and `npm run typecheck`.
