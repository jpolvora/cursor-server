import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { AgentId } from "../agents.js";
import type { RunTaskResult } from "./agent-runner.js";
import type { McpServers } from "./mcp-config.js";

export type TaskSource = "ide" | "hermes" | "umbrel" | "api";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface TaskRecord {
  id: string;
  tenantId: string;
  prompt: string;
  repo: string;
  repoPath: string;
  agent: AgentId;
  model: string;
  source: TaskSource;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: RunTaskResult;
  error?: string;
  webhookUrl?: string;
  mcpServers?: McpServers;
}

export interface CreateTaskOptions {
  tenantId: string;
  prompt: string;
  repo: string;
  repoPath: string;
  agent: AgentId;
  model: string;
  source?: TaskSource;
  webhookUrl?: string;
  mcpServers?: McpServers;
}

export const STALE_TASK_RESTART_ERROR =
  "Server process restarted; task was not recovered (worker was interrupted on startup).";

export class TaskStore {
  private tasks = new Map<string, TaskRecord>();
  private storagePath: string | null = null;
  public readonly events = new EventEmitter();

  public init(reposRoot: string) {
    this.storagePath = path.resolve(reposRoot, ".tasks.json");
    this.loadFromDisk();
  }

  private reconcileStaleTasks(records: TaskRecord[]): TaskRecord[] {
    const reconciledIds: string[] = [];
    const now = new Date().toISOString();

    const reconciled = records.map((record) => {
      if (record.status !== "running" && record.status !== "queued") {
        return record;
      }

      reconciledIds.push(record.id);
      return {
        ...record,
        status: "failed" as const,
        error: STALE_TASK_RESTART_ERROR,
        completedAt: record.completedAt ?? now,
      };
    });

    if (reconciledIds.length > 0) {
      console.warn(
        `Reconciled ${reconciledIds.length} stale task(s) after restart: ${reconciledIds.join(", ")}`
      );
    }

    return reconciled;
  }

  private loadFromDisk() {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.storagePath, "utf-8");
      const records: TaskRecord[] = JSON.parse(data);
      const reconciled = this.reconcileStaleTasks(records);
      const didReconcile = reconciled.some(
        (record, index) => record !== records[index]
      );

      for (const record of reconciled) {
        this.tasks.set(record.id, record);
      }

      if (didReconcile) {
        this.saveToDisk();
      }
    } catch (err) {
      console.error("Failed to load tasks from disk:", err);
    }
  }

  private saveToDisk() {
    if (!this.storagePath) return;

    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const records = Array.from(this.tasks.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(records, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save tasks to disk:", err);
    }
  }

  public createTask(options: CreateTaskOptions): TaskRecord {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: TaskRecord = {
      id,
      tenantId: options.tenantId,
      prompt: options.prompt,
      repo: options.repo,
      repoPath: options.repoPath,
      agent: options.agent,
      model: options.model,
      source: options.source ?? "api",
      status: "queued",
      createdAt: new Date().toISOString(),
      webhookUrl: options.webhookUrl,
      mcpServers: options.mcpServers,
    };

    this.tasks.set(id, record);
    this.saveToDisk();
    this.events.emit("task:status", { id, status: record.status, record });
    return record;
  }

  public getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  public updateTask(id: string, updates: Partial<TaskRecord>): TaskRecord | undefined {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    const updated: TaskRecord = {
      ...existing,
      ...updates,
    };

    this.tasks.set(id, updated);
    this.saveToDisk();
    if (updates.status) {
      this.events.emit("task:status", { id, status: updated.status, record: updated });
    }
    return updated;
  }

  public emitOutput(id: string, chunk: string) {
    this.events.emit("task:output", { id, chunk });
  }

  public listTasks(filter?: { status?: string; repo?: string; source?: string; tenantId?: string }): TaskRecord[] {
    let records = Array.from(this.tasks.values());

    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.status) {
      records = records.filter((r) => r.status === filter.status);
    }
    if (filter?.repo) {
      records = records.filter((r) => r.repo === filter.repo);
    }
    if (filter?.source) {
      records = records.filter((r) => r.source === filter.source);
    }

    return records.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export const taskStore = new TaskStore();
