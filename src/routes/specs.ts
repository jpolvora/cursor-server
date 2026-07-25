import { Hono } from "hono";
import type { Config } from "../config.js";
import { validateRepoPath } from "../services/repo-validator.js";
import { listRepoSpecs, validateSpecPayload } from "../services/spec-schema.js";

export function createSpecRoutes(_config: Config) {
  const specs = new Hono();

  // Validate spec payload (Markdown, JSON string, or structured object)
  specs.post("/validate", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      const rawText = await c.req.text();
      body = rawText;
    }

    const payload = typeof body === "object" && body !== null && "content" in body ? (body as { content: unknown }).content : body;
    const result = validateSpecPayload(payload);

    if (result.valid) {
      return c.json({ valid: true, spec: result.spec }, 200);
    }
    return c.json({ valid: false, errors: result.errors }, 400);
  });

  return specs;
}

export function createRepoSpecRoutes(config: Config) {
  const repoSpecs = new Hono();

  // List valid and invalid specs in a repository
  repoSpecs.get("/:repo/specs", (c) => {
    const repo = c.req.param("repo");
    const repoResult = validateRepoPath(config.REPOS_ROOT, repo);

    if (!repoResult.valid || !repoResult.resolvedPath) {
      return c.json({ error: repoResult.error }, 400);
    }

    const specsList = listRepoSpecs(repoResult.resolvedPath);
    return c.json({ repo, specs: specsList });
  });

  return repoSpecs;
}
