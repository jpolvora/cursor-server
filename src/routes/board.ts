import { Hono } from "hono";
import { z } from "zod";
import type { Config } from "../config.js";
import { checkRepoAccess } from "../services/tenant-context.js";
import {
  boardDb,
  BOARD_LANES,
  PLANNING_LANES,
  type BoardLane,
} from "../services/board-db.js";
import { resolveSecretRef } from "../services/board-secret.js";
import {
  cleanupClone,
  ensureClone,
  isCloneMissingOrEmpty,
  resolveRepoLocalPath,
} from "../services/board-clone.js";
import { exportCardSpec, importSpecsFromClone } from "../services/board-import-export.js";
import {
  finishCard,
  getCardStatus,
  initBoardExecutionSync,
  pauseCard,
  resumeCard,
  startCard,
} from "../services/board-execution.js";

const remoteUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "remote_url must use http or https");

const CreateRepoSchema = z.object({
  name: z.string().min(1).max(128),
  remote_url: remoteUrlSchema,
  secret_ref: z.string().min(1),
  local_path: z.string().optional().nullable(),
});

const UpdateRepoSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  remote_url: remoteUrlSchema.optional(),
  secret_ref: z.string().min(1).optional(),
  local_path: z.string().optional().nullable(),
});

const CreateCardSchema = z.object({
  repo_id: z.number().int().positive(),
  title: z.string().min(1).max(256),
  spec_markdown: z.string().min(1).max(512_000),
  lane: z.enum(BOARD_LANES as unknown as [string, ...string[]]).optional(),
  workflow: z.string().optional().nullable(),
  active_run_id: z.string().optional().nullable(),
  step_label: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

const UpdateCardSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  spec_markdown: z.string().min(1).max(512_000).optional(),
  lane: z.enum(BOARD_LANES as unknown as [string, ...string[]]).optional(),
  sort_order: z.number().int().optional(),
});

const MoveCardSchema = z.object({
  lane: z.enum(BOARD_LANES as unknown as [string, ...string[]]),
});

const StartCardSchema = z.object({
  workflow: z.enum(["full", "lite"]),
  flags: z.array(z.string()).optional(),
  model: z.string().optional(),
  confirm: z.literal(true),
});

const FinishCardSchema = z.object({
  confirm: z.literal(true),
});

function repoResponse(repo: ReturnType<typeof boardDb.getRepo>) {
  if (!repo) return null;
  return {
    id: repo.id,
    name: repo.name,
    remote_url: repo.remote_url,
    secret_ref: repo.secret_ref,
    local_path: repo.local_path,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
  };
}

function cardResponse(card: NonNullable<ReturnType<typeof boardDb.getCard>>) {
  return {
    id: card.id,
    repo_id: card.repo_id,
    title: card.title,
    spec_markdown: card.spec_markdown,
    lane: card.lane,
    workflow: card.workflow,
    active_run_id: card.active_run_id,
    step_label: card.step_label,
    sort_order: card.sort_order,
    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

function parseIdParam(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function checkRepoTenantAccess(c: { get: (key: "allowedRepos") => string[] }, repoName: string) {
  const accessError = checkRepoAccess(c.get("allowedRepos") ?? [], repoName);
  return accessError;
}

export function createBoardRoutes(config: Config) {
  initBoardExecutionSync();
  const board = new Hono();

  // --- Repos ---

  board.get("/repos", (c) => {
    const repos = boardDb
      .listRepos()
      .filter((repo) => !checkRepoTenantAccess(c, repo.name));
    return c.json({ repos: repos.map((r) => repoResponse(r)) });
  });

  board.post("/repos", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateRepoSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const accessError = checkRepoTenantAccess(c, parsed.data.name);
    if (accessError) {
      return c.json({ error: accessError }, 403);
    }

    if (boardDb.getRepoByName(parsed.data.name)) {
      return c.json({ error: `Repository '${parsed.data.name}' already exists` }, 409);
    }

    const localPath = (() => {
      try {
        return resolveRepoLocalPath(
          config.REPOS_ROOT,
          parsed.data.name,
          parsed.data.local_path,
        );
      } catch (err: unknown) {
        return null;
      }
    })();
    if (!localPath) {
      return c.json({ error: "Invalid repository path (must stay under REPOS_ROOT)" }, 400);
    }

    try {
      const repo = boardDb.createRepo({
        ...parsed.data,
        local_path: localPath,
      });
      return c.json({ repo: repoResponse(repo) }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("constraint")) {
        return c.json({ error: `Repository '${parsed.data.name}' already exists` }, 409);
      }
      throw err;
    }
  });

  board.get("/repos/:id", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const repo = boardDb.getRepo(id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    return c.json({ repo: repoResponse(repo) });
  });

  board.put("/repos/:id", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const existing = boardDb.getRepo(id);
    if (!existing) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, existing.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const body = await c.req.json().catch(() => null);
    const parsed = UpdateRepoSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const nameAccess = checkRepoTenantAccess(c, parsed.data.name);
      if (nameAccess) return c.json({ error: nameAccess }, 403);
      if (boardDb.getRepoByName(parsed.data.name)) {
        return c.json({ error: `Repository '${parsed.data.name}' already exists` }, 409);
      }
    }

    if (parsed.data.local_path !== undefined) {
      let resolvedPath: string;
      try {
        resolvedPath = resolveRepoLocalPath(
          config.REPOS_ROOT,
          parsed.data.name ?? existing.name,
          parsed.data.local_path,
        );
      } catch {
        return c.json({ error: "Invalid repository path (must stay under REPOS_ROOT)" }, 400);
      }
      parsed.data.local_path = resolvedPath;
    }

    const repo = boardDb.updateRepo(id, parsed.data);
    return c.json({ repo: repoResponse(repo) });
  });

  board.delete("/repos/:id", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const existing = boardDb.getRepo(id);
    if (!existing) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, existing.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const n = boardDb.countCardsByRepo(id);
    if (n > 0) {
      return c.json(
        { error: `Cannot delete repository: ${n} card(s) still reference it` },
        409,
      );
    }

    try {
      const localPath = resolveRepoLocalPath(config.REPOS_ROOT, existing.name, existing.local_path);
      cleanupClone(localPath);
    } catch {
      // ignore invalid stored paths during delete
    }

    boardDb.deleteRepo(id);
    return c.json({ ok: true });
  });

  board.post("/repos/:id/ensure-clone", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const repo = boardDb.getRepo(id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const secret = resolveSecretRef(repo.secret_ref, config.SECRETS_DIR);
    if (!secret.ok) {
      return c.json({ error: secret.error }, 400);
    }

    const localPath = resolveRepoLocalPath(config.REPOS_ROOT, repo.name, repo.local_path);
    if (!isCloneMissingOrEmpty(localPath)) {
      return c.json({ ok: true, cloned: false, local_path: localPath });
    }

    const result = await ensureClone(repo.remote_url, localPath, secret.value);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ ok: true, cloned: true, local_path: localPath });
  });

  board.post("/repos/:id/cleanup-clone", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const repo = boardDb.getRepo(id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const localPath = resolveRepoLocalPath(config.REPOS_ROOT, repo.name, repo.local_path);
    const result = cleanupClone(localPath);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ ok: true });
  });

  board.post("/repos/:id/import-specs", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid repo id" }, 400);

    const repo = boardDb.getRepo(id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const localPath = resolveRepoLocalPath(config.REPOS_ROOT, repo.name, repo.local_path);
    if (isCloneMissingOrEmpty(localPath)) {
      return c.json({ error: "Clone is missing or empty; run ensure-clone first" }, 400);
    }

    const result = importSpecsFromClone(localPath, id, (repoId, title, specMarkdown) =>
      boardDb.upsertCardByTitle(repoId, title, specMarkdown),
    );

    if (result.errors.length > 0 && result.imported.length === 0) {
      return c.json({ error: "Import failed", ...result }, 422);
    }

    if (result.errors.length > 0) {
      return c.json({ ...result, partial: true }, 207);
    }

    return c.json(result);
  });

  // --- Cards ---

  board.get("/cards", (c) => {
    const repoIdRaw = c.req.query("repoId");
    const laneRaw = c.req.query("lane");

    const filters: { repoId?: number; lane?: BoardLane } = {};
    if (repoIdRaw) {
      const repoId = Number(repoIdRaw);
      if (!Number.isInteger(repoId) || repoId <= 0) {
        return c.json({ error: "Invalid repoId filter" }, 400);
      }
      filters.repoId = repoId;
    }
    if (laneRaw) {
      if (!BOARD_LANES.includes(laneRaw as BoardLane)) {
        return c.json({ error: "Invalid lane filter" }, 400);
      }
      filters.lane = laneRaw as BoardLane;
    }

    const cards = boardDb.listCards(filters).filter((card) => {
      const repo = boardDb.getRepo(card.repo_id);
      if (!repo) return false;
      return !checkRepoTenantAccess(c, repo.name);
    });
    return c.json({ cards: cards.map(cardResponse) });
  });

  board.post("/cards", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const repo = boardDb.getRepo(parsed.data.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    try {
      const card = boardDb.createCard({
        ...parsed.data,
        lane: parsed.data.lane as BoardLane | undefined,
      });
      return c.json({ card: cardResponse(card) }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  board.get("/cards/:id", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const card = boardDb.getCard(id);
    if (!card) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(card.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    return c.json({ card: cardResponse(card) });
  });

  board.put("/cards/:id", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const body = await c.req.json().catch(() => null);
    const parsed = UpdateCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    try {
      const card = boardDb.updateCard(id, {
        title: parsed.data.title,
        spec_markdown: parsed.data.spec_markdown,
        lane: parsed.data.lane as BoardLane | undefined,
        sort_order: parsed.data.sort_order,
      });
      if (!card) {
        return c.json({ error: "Card not found" }, 404);
      }
      return c.json({ card: cardResponse(card) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  board.delete("/cards/:id", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    boardDb.deleteCard(id);
    return c.json({ ok: true });
  });

  board.post("/cards/:id/move", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    if (existing.active_run_id) {
      return c.json({ error: "Cannot move card while an active run is in progress" }, 409);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = MoveCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const targetLane = parsed.data.lane as BoardLane;
    if (!PLANNING_LANES.includes(targetLane)) {
      return c.json(
        { error: `Lane '${targetLane}' is not allowed for manual moves (planning lanes only)` },
        400,
      );
    }

    const card = boardDb.updateCard(id, { lane: targetLane });
    if (!card) {
      return c.json({ error: "Card not found" }, 404);
    }
    return c.json({ card: cardResponse(card) });
  });

  board.post("/cards/:id/start", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const body = await c.req.json().catch(() => null);
    const parsed = StartCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const tenantId = (c.get("tenantId") as string) ?? "master";
    const result = await startCard(config, id, parsed.data, tenantId);
    if (!result.ok) {
      return c.json(
        {
          error: result.error,
          ...(result.errors ? { errors: result.errors } : {}),
          ...(result.issues ? { issues: result.issues } : {}),
        },
        result.status as 400 | 404 | 409 | 422 | 500,
      );
    }

    return c.json({ card: result.card, taskId: result.taskId, resumed: result.resumed }, result.resumed ? 200 : 202);
  });

  board.post("/cards/:id/pause", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const result = pauseCard(id);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 404 | 409);
    }

    return c.json({ card: result.card });
  });

  board.post("/cards/:id/resume", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const result = await resumeCard(config, id);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 404 | 409);
    }

    return c.json({ card: result.card }, 202);
  });

  board.post("/cards/:id/finish", async (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const body = await c.req.json().catch(() => ({}));
    const parsed = FinishCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const result = finishCard(id, parsed.data);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 400 | 404);
    }

    return c.json({ card: result.card });
  });

  board.get("/cards/:id/status", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const existing = boardDb.getCard(id);
    if (!existing) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(existing.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const result = getCardStatus(id);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 404);
    }

    return c.json(result.status);
  });

  board.post("/cards/:id/export-spec", (c) => {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid card id" }, 400);

    const card = boardDb.getCard(id);
    if (!card) return c.json({ error: "Card not found" }, 404);

    const repo = boardDb.getRepo(card.repo_id);
    if (!repo) return c.json({ error: "Repository not found" }, 404);

    const accessError = checkRepoTenantAccess(c, repo.name);
    if (accessError) return c.json({ error: accessError }, 403);

    const localPath = resolveRepoLocalPath(config.REPOS_ROOT, repo.name, repo.local_path);
    if (isCloneMissingOrEmpty(localPath)) {
      return c.json({ error: "Clone is missing or empty; run ensure-clone first" }, 400);
    }

    try {
      const result = exportCardSpec(localPath, card);
      return c.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errors =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: string[] }).errors
          : undefined;
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 422) {
        return c.json({ error: message, errors }, 422);
      }
      return c.json({ error: message, errors }, 400);
    }
  });

  return board;
}
