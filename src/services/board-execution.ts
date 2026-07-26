import path from "node:path";
import type { Config } from "../config.js";
import { boardDb, type BoardCard } from "./board-db.js";
import { resolveSecretRef } from "./board-secret.js";
import {
  ensureClone,
  isCloneMissingOrEmpty,
  resolveRepoLocalPath,
} from "./board-clone.js";
import { exportCardSpec } from "./board-import-export.js";
import { resolveMcpForTask } from "./mcp-config.js";
import { taskStore, type TaskRecord } from "./task-store.js";
import { cancelTask, processTaskInBackground, requeueTask } from "./task-worker.js";
import {
  buildTaskPrompt,
  extractStepHintFromOutput,
  mapProgressHint,
  type BoardWorkflow,
} from "./board-step-sync.js";

export interface StartCardInput {
  workflow: BoardWorkflow;
  flags?: string[];
  model?: string;
  confirm?: boolean;
}

export interface FinishCardInput {
  confirm?: boolean;
}

export interface CardStatusResponse {
  card: ReturnType<typeof cardFields>;
  run: {
    id: string;
    status: string;
    agent: string;
    model: string;
    step_label: string | null;
    lane: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  } | null;
}

function cardFields(card: BoardCard) {
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

function findCardByRunId(runId: string): BoardCard | null {
  return boardDb.listCards().find((c) => c.active_run_id === runId) ?? null;
}

function workflowAgent(workflow: BoardWorkflow): "spec-to-pr" | "spec-to-pr-lite" {
  return workflow === "lite" ? "spec-to-pr-lite" : "spec-to-pr";
}

function syncCardLaneFromTask(card: BoardCard, task: TaskRecord, outputHint?: string): BoardCard {
  if (card.lane === "paused" || card.lane === "done") {
    return card;
  }

  const workflow = (card.workflow === "lite" ? "lite" : "full") as BoardWorkflow;
  const hint =
    outputHint ??
    card.step_label ??
    task.status;

  const mapped = mapProgressHint(workflow, String(hint), task.status);

  const updated = boardDb.updateCard(card.id, {
    lane: mapped.lane,
    step_label: mapped.stepLabel,
  });
  return updated ?? card;
}

export function syncCardFromTask(taskId: string, outputChunk?: string): void {
  const card = findCardByRunId(taskId);
  if (!card || !card.active_run_id) return;

  const task = taskStore.getTask(taskId);
  if (!task) return;

  const hint = outputChunk ? extractStepHintFromOutput(outputChunk) ?? undefined : undefined;
  syncCardLaneFromTask(card, task, hint);
}

let syncInitialized = false;

export function initBoardExecutionSync(): void {
  if (syncInitialized) return;
  syncInitialized = true;

  taskStore.events.on("task:status", (data: { id: string; status: string; record: TaskRecord }) => {
    syncCardFromTask(data.id);
  });

  taskStore.events.on("task:output", (data: { id: string; chunk: string }) => {
    syncCardFromTask(data.id, data.chunk);
  });
}

async function ensureRepoClone(
  config: Config,
  repo: NonNullable<ReturnType<typeof boardDb.getRepo>>,
): Promise<{ ok: true; localPath: string } | { ok: false; error: string; status: number }> {
  const secret = resolveSecretRef(repo.secret_ref, config.SECRETS_DIR);
  if (!secret.ok) {
    return { ok: false, error: secret.error, status: 400 };
  }

  const localPath = resolveRepoLocalPath(config.REPOS_ROOT, repo.name, repo.local_path);
  if (!isCloneMissingOrEmpty(localPath)) {
    return { ok: true, localPath };
  }

  const result = await ensureClone(repo.remote_url, localPath, secret.value);
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 };
  }

  return { ok: true, localPath };
}

function enqueueSpecTask(
  config: Config,
  input: {
    tenantId: string;
    repoName: string;
    repoPath: string;
    workflow: BoardWorkflow;
    specRelativePath: string;
    flags?: string[];
    model?: string;
  },
): TaskRecord {
  const agent = workflowAgent(input.workflow);
  const prompt = buildTaskPrompt(input.specRelativePath, input.workflow, input.flags);
  const model = input.model ?? config.CURSOR_MODEL;

  const mcpServers = resolveMcpForTask(config.REPOS_ROOT, input.repoName);
  const mcpForTask = Object.keys(mcpServers).length > 0 ? mcpServers : undefined;

  const task = taskStore.createTask({
    tenantId: input.tenantId,
    prompt,
    repo: input.repoName,
    repoPath: input.repoPath,
    agent,
    model,
    source: "api",
    mcpServers: mcpForTask,
  });

  processTaskInBackground(config, task.id);
  return task;
}

export async function startCard(
  config: Config,
  cardId: number,
  input: StartCardInput,
  tenantId: string,
): Promise<
  | { ok: true; card: ReturnType<typeof cardFields>; taskId: string; resumed: boolean }
  | { ok: false; error: string; status: number }
> {
  if (!input.confirm) {
    return { ok: false, error: "Start requires confirm: true", status: 400 };
  }

  const card = boardDb.getCard(cardId);
  if (!card) return { ok: false, error: "Card not found", status: 404 };

  if (card.active_run_id && card.lane === "paused") {
    const resumed = resumeCard(config, cardId);
    if (!resumed.ok) return resumed;
    const updated = boardDb.getCard(cardId)!;
    return { ok: true, card: cardFields(updated), taskId: updated.active_run_id!, resumed: true };
  }

  if (card.active_run_id) {
    return { ok: false, error: "Card already has an active run", status: 409 };
  }

  const repo = boardDb.getRepo(card.repo_id);
  if (!repo) return { ok: false, error: "Repository not found", status: 404 };

  const cloneResult = await ensureRepoClone(config, repo);
  if (!cloneResult.ok) {
    return { ok: false, error: cloneResult.error, status: cloneResult.status };
  }

  let exportResult: { filename: string; path: string };
  try {
    exportResult = exportCardSpec(cloneResult.localPath, card);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, status: 422 };
  }

  const specRelativePath = path.posix.join(".agents/specs", exportResult.filename);
  const task = enqueueSpecTask(config, {
    tenantId,
    repoName: repo.name,
    repoPath: cloneResult.localPath,
    workflow: input.workflow,
    specRelativePath,
    flags: input.flags,
    model: input.model,
  });

  const updated = boardDb.updateCard(cardId, {
    active_run_id: task.id,
    workflow: input.workflow,
    lane: "implementing",
    step_label: "starting",
  });

  return {
    ok: true,
    card: cardFields(updated!),
    taskId: task.id,
    resumed: false,
  };
}

export function pauseCard(
  cardId: number,
): { ok: true; card: ReturnType<typeof cardFields> } | { ok: false; error: string; status: number } {
  const card = boardDb.getCard(cardId);
  if (!card) return { ok: false, error: "Card not found", status: 404 };

  if (!card.active_run_id) {
    return { ok: false, error: "No active run to pause", status: 409 };
  }

  if (card.lane === "paused") {
    return { ok: false, error: "Card is already paused", status: 409 };
  }

  cancelTask(card.active_run_id, "Paused from board");

  const updated = boardDb.updateCard(cardId, {
    lane: "paused",
    step_label: card.step_label ?? "paused",
  });

  return { ok: true, card: cardFields(updated!) };
}

export function resumeCard(
  config: Config,
  cardId: number,
): { ok: true; card: ReturnType<typeof cardFields> } | { ok: false; error: string; status: number } {
  const card = boardDb.getCard(cardId);
  if (!card) return { ok: false, error: "Card not found", status: 404 };

  if (!card.active_run_id) {
    return { ok: false, error: "No active run to resume", status: 409 };
  }

  if (card.lane !== "paused") {
    return { ok: false, error: "Card is not paused", status: 409 };
  }

  const requeued = requeueTask(config, card.active_run_id);
  if (!requeued) {
    return { ok: false, error: "Unable to resume task; run may still be active", status: 409 };
  }

  const updated = boardDb.updateCard(cardId, {
    lane: "implementing",
    step_label: "resuming",
  });

  return { ok: true, card: cardFields(updated!) };
}

export function finishCard(
  cardId: number,
  input: FinishCardInput,
): { ok: true; card: ReturnType<typeof cardFields> } | { ok: false; error: string; status: number } {
  if (!input.confirm) {
    return { ok: false, error: "Finish requires confirm: true", status: 400 };
  }

  const card = boardDb.getCard(cardId);
  if (!card) return { ok: false, error: "Card not found", status: 404 };

  if (card.active_run_id) {
    const task = taskStore.getTask(card.active_run_id);
    if (task && (task.status === "queued" || task.status === "running")) {
      cancelTask(card.active_run_id, "Finished from board");
    }
  }

  const updated = boardDb.updateCard(cardId, {
    active_run_id: null,
    lane: "done",
    step_label: "done",
  });

  return { ok: true, card: cardFields(updated!) };
}

export function getCardStatus(
  cardId: number,
): { ok: true; status: CardStatusResponse } | { ok: false; error: string; status: number } {
  const card = boardDb.getCard(cardId);
  if (!card) return { ok: false, error: "Card not found", status: 404 };

  let runSummary: CardStatusResponse["run"] = null;
  if (card.active_run_id) {
    const task = taskStore.getTask(card.active_run_id);
    if (task) {
      runSummary = {
        id: task.id,
        status: task.status,
        agent: task.agent,
        model: task.model,
        step_label: card.step_label,
        lane: card.lane,
        error: task.error,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      };
    }
  }

  return {
    ok: true,
    status: {
      card: cardFields(card),
      run: runSummary,
    },
  };
}
