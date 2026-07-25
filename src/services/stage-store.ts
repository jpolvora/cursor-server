import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { HarnessStage } from "./harness-runner.js";
import type { QualifiedSpec } from "./spec-schema.js";

export type PipelineRunStatus = "queued" | "running" | "success" | "failed" | "error";
export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "error";

export interface PipelineStageRecord {
  stage: HarnessStage;
  status: PipelineStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  logs: string[];
  artifacts?: string[];
  error?: string;
}

export interface PipelineRunRecord {
  id: string;
  specId: string;
  specTitle: string;
  repoPath: string;
  runnerId: string;
  status: PipelineRunStatus;
  currentStage?: HarnessStage;
  stages: PipelineStageRecord[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  spec?: QualifiedSpec;
}

export interface CreatePipelineRunOptions {
  spec: QualifiedSpec;
  repoPath: string;
  runnerId?: string;
}

export class StageStore {
  private runs = new Map<string, PipelineRunRecord>();
  private storagePath: string | null = null;
  public readonly events = new EventEmitter();

  public init(reposRoot: string): void {
    this.storagePath = path.resolve(reposRoot, ".stage-runs.json");
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.storagePath, "utf-8");
      const records: PipelineRunRecord[] = JSON.parse(data);
      for (const record of records) {
        this.runs.set(record.id, record);
      }
    } catch (err) {
      console.error("Failed to load stage runs from disk:", err);
    }
  }

  private saveToDisk(): void {
    if (!this.storagePath) return;

    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const records = Array.from(this.runs.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(records, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save stage runs to disk:", err);
    }
  }

  public createRun(options: CreatePipelineRunOptions): PipelineRunRecord {
    const id = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const stages: PipelineStageRecord[] = (options.spec.stages as HarnessStage[]).map((stage) => ({
      stage,
      status: "pending",
      logs: [],
    }));

    const record: PipelineRunRecord = {
      id,
      specId: options.spec.id,
      specTitle: options.spec.title,
      repoPath: options.repoPath,
      runnerId: options.runnerId || "cursor-local",
      status: "queued",
      currentStage: stages[0]?.stage,
      stages,
      createdAt: new Date().toISOString(),
      spec: options.spec,
    };

    this.runs.set(id, record);
    this.saveToDisk();
    this.events.emit("run:status", { id, status: record.status, record });
    return record;
  }

  public getRun(id: string): PipelineRunRecord | undefined {
    return this.runs.get(id);
  }

  public updateRun(id: string, updates: Partial<PipelineRunRecord>): PipelineRunRecord | undefined {
    const existing = this.runs.get(id);
    if (!existing) return undefined;

    const updated: PipelineRunRecord = {
      ...existing,
      ...updates,
    };

    this.runs.set(id, updated);
    this.saveToDisk();
    if (updates.status) {
      this.events.emit("run:status", { id, status: updated.status, record: updated });
    }
    return updated;
  }

  public updateStage(
    runId: string,
    stageName: HarnessStage,
    stageUpdates: Partial<PipelineStageRecord>
  ): PipelineRunRecord | undefined {
    const existing = this.runs.get(runId);
    if (!existing) return undefined;

    const stageIndex = existing.stages.findIndex((s) => s.stage === stageName);
    if (stageIndex === -1) return undefined;

    const updatedStages = [...existing.stages];
    updatedStages[stageIndex] = {
      ...updatedStages[stageIndex],
      ...stageUpdates,
    };

    const updated: PipelineRunRecord = {
      ...existing,
      stages: updatedStages,
    };

    this.runs.set(runId, updated);
    this.saveToDisk();
    this.events.emit("stage:status", { runId, stage: stageName, stageRecord: updatedStages[stageIndex] });
    return updated;
  }

  public listRuns(filter?: { status?: string; specId?: string }): PipelineRunRecord[] {
    let records = Array.from(this.runs.values());

    if (filter?.status) {
      records = records.filter((r) => r.status === filter.status);
    }
    if (filter?.specId) {
      records = records.filter((r) => r.specId === filter.specId);
    }

    return records.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public clear(): void {
    this.runs.clear();
    this.saveToDisk();
  }
}

export const stageStore = new StageStore();
