import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { validateRepoPath } from "../services/repo-validator.js";
import {
  listRepoSpecs,
  readRepoSpecFile,
  validateSpecPayload,
  writeRepoSpecFile,
} from "../services/spec-schema.js";

const WriteSpecBodySchema = z.object({
  content: z.string(),
  /** When true, reject write if content fails validateSpecPayload. Default true. */
  requireValid: z.boolean().optional().default(true),
});

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

  // Read a single spec file (basename under known specs dirs)
  repoSpecs.get("/:repo/specs/:file", (c) => {
    const repo = c.req.param("repo");
    const file = c.req.param("file");
    const repoResult = validateRepoPath(config.REPOS_ROOT, repo);

    if (!repoResult.valid || !repoResult.resolvedPath) {
      return c.json({ error: repoResult.error }, repoResult.status === 404 ? 404 : 400);
    }

    try {
      const result = readRepoSpecFile(repoResult.resolvedPath, file);
      return c.json({ repo, file, path: result.path, content: result.content });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      if (code === "ENOENT") {
        return c.json({ error: message }, 404);
      }
      return c.json({ error: message }, 400);
    }
  });

  // Write a single spec file under .agents/specs/
  repoSpecs.put("/:repo/specs/:file", async (c) => {
    const repo = c.req.param("repo");
    const file = c.req.param("file");
    const repoResult = validateRepoPath(config.REPOS_ROOT, repo);

    if (!repoResult.valid || !repoResult.resolvedPath) {
      return c.json({ error: repoResult.error }, repoResult.status === 404 ? 404 : 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = WriteSpecBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request payload",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        400,
      );
    }

    const { content, requireValid } = parsed.data;
    if (requireValid) {
      const validation = validateSpecPayload(content);
      if (!validation.valid) {
        return c.json({ error: "Spec validation failed", errors: validation.errors }, 400);
      }
    }

    try {
      const written = writeRepoSpecFile(repoResult.resolvedPath, file, content);
      return c.json({ ok: true, path: written.path });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  return repoSpecs;
}
