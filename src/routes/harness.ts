import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { runnerRegistry } from "../services/harness-runner.js";
import "../services/opencode-runner.js";
import "../services/hermes-runner.js";
import { validateRepoPath } from "../services/repo-validator.js";
import { validateSpecPayload } from "../services/spec-schema.js";
import { stageOrchestrator } from "../services/stage-orchestrator.js";
import { stageStore } from "../services/stage-store.js";

const TriggerRunSchema = z.object({
  spec: z.union([z.string(), z.record(z.unknown())]),
  repo: z.string().optional(),
  repoPath: z.string().optional(),
  runnerId: z.string().optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
});

const ResumeRunSchema = z
  .object({
    runnerId: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

export function createHarnessRoutes(config: Config) {
  const harnessRoutes = new Hono();

  /**
   * POST /harness/runs - Trigger a new stage pipeline run asynchronously
   */
  harnessRoutes.post("/runs", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const parseResult = TriggerRunSchema.safeParse(body);

      if (!parseResult.success) {
        return c.json(
          {
            error: "Invalid request payload",
            details: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          },
          400,
        );
      }

      const { spec: rawSpec, repo, repoPath: rawRepoPath, runnerId, agent, model } = parseResult.data;

      let repoPath: string;
      if (rawRepoPath) {
        repoPath = rawRepoPath;
      } else if (repo) {
        const v = validateRepoPath(config.REPOS_ROOT, repo);
        if (!v.valid || !v.resolvedPath) {
          return c.json({ error: v.error || "Invalid repository" }, v.status === 404 ? 404 : 400);
        }
        repoPath = v.resolvedPath;
      } else {
        repoPath = process.cwd();
      }

      const specValidation = validateSpecPayload(rawSpec);
      if (!specValidation.valid || !specValidation.spec) {
        return c.json(
          {
            error: "Invalid specification format",
            details: specValidation.errors || ["Could not parse specification"],
          },
          400,
        );
      }

      const runRecord = stageOrchestrator.runAsync(specValidation.spec, repoPath, {
        runnerId,
        agent,
        model,
      });

      return c.json(
        {
          runId: runRecord.id,
          status: runRecord.status,
          message: "Pipeline stage execution dispatched asynchronously",
          specId: runRecord.specId,
        },
        202,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  /**
   * POST /harness/runs/:runId/resume - Resume a failed or incomplete pipeline run
   */
  harnessRoutes.post("/runs/:runId/resume", async (c) => {
    try {
      const runId = c.req.param("runId");
      const existing = stageStore.getRun(runId);

      if (!existing) {
        return c.json({ error: `Pipeline run '${runId}' not found` }, 404);
      }

      let options: { runnerId?: string; agent?: string; model?: string } | undefined;
      const body = await c.req.json().catch(() => null);
      if (body) {
        const parsed = ResumeRunSchema.safeParse(body);
        if (parsed.success && parsed.data) {
          options = parsed.data;
        }
      }

      const runRecord = stageOrchestrator.resumeAsync(runId, options);

      return c.json(
        {
          runId: runRecord.id,
          status: runRecord.status,
          message: "Pipeline stage execution resumed asynchronously",
        },
        202,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  /**
   * GET /harness/runs/:runId - Query pipeline run details and stage outputs
   */
  harnessRoutes.get("/runs/:runId", (c) => {
    const runId = c.req.param("runId");
    const run = stageStore.getRun(runId);

    if (!run) {
      return c.json({ error: `Pipeline run '${runId}' not found` }, 404);
    }

    return c.json({ run });
  });

  /**
   * GET /harness/runs - List all pipeline runs
   */
  harnessRoutes.get("/runs", (c) => {
    const status = c.req.query("status");
    const specId = c.req.query("specId");
    const runs = stageStore.listRuns({ status, specId });
    return c.json({ runs });
  });

  /**
   * GET /harness/runners - List registered harness runners
   */
  harnessRoutes.get("/runners", (c) => {
    const runners = runnerRegistry.list().map((r) => ({
      id: r.id,
      name: r.name,
      supportedStages: r.supportedStages,
    }));
    return c.json({ runners, defaultRunnerId: runnerRegistry.getDefaultId() });
  });

  return harnessRoutes;
}
