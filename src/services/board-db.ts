import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";

export const BOARD_LANES = [
  "backlog",
  "refine",
  "ready",
  "implementing",
  "review",
  "ship",
  "done",
  "blocked",
  "paused",
] as const;

export type BoardLane = (typeof BOARD_LANES)[number];

export const PLANNING_LANES: BoardLane[] = ["backlog", "refine", "ready", "blocked"];

export interface BoardRepo {
  id: number;
  name: string;
  remote_url: string;
  secret_ref: string;
  local_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardCard {
  id: number;
  repo_id: number;
  title: string;
  spec_markdown: string;
  lane: BoardLane;
  workflow: string | null;
  active_run_id: string | null;
  step_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRepoInput {
  name: string;
  remote_url: string;
  secret_ref: string;
  local_path?: string | null;
}

export interface UpdateRepoInput {
  name?: string;
  remote_url?: string;
  secret_ref?: string;
  local_path?: string | null;
}

export interface CreateCardInput {
  repo_id: number;
  title: string;
  spec_markdown: string;
  lane?: BoardLane;
  workflow?: string | null;
  active_run_id?: string | null;
  step_label?: string | null;
  sort_order?: number;
}

export interface UpdateCardInput {
  title?: string;
  spec_markdown?: string;
  lane?: BoardLane;
  workflow?: string | null;
  active_run_id?: string | null;
  step_label?: string | null;
  sort_order?: number;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    remote_url TEXT NOT NULL,
    secret_ref TEXT NOT NULL,
    local_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    spec_markdown TEXT NOT NULL,
    lane TEXT NOT NULL DEFAULT 'backlog',
    workflow TEXT,
    active_run_id TEXT,
    step_label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cards_repo_lane ON cards(repo_id, lane)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_repo_title ON cards(repo_id, title)`,
];

function rowToRepo(row: Record<string, unknown>): BoardRepo {
  return {
    id: Number(row.id),
    name: String(row.name),
    remote_url: String(row.remote_url),
    secret_ref: String(row.secret_ref),
    local_path: row.local_path == null ? null : String(row.local_path),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function rowToCard(row: Record<string, unknown>): BoardCard {
  return {
    id: Number(row.id),
    repo_id: Number(row.repo_id),
    title: String(row.title),
    spec_markdown: String(row.spec_markdown),
    lane: String(row.lane) as BoardLane,
    workflow: row.workflow == null ? null : String(row.workflow),
    active_run_id: row.active_run_id == null ? null : String(row.active_run_id),
    step_label: row.step_label == null ? null : String(row.step_label),
    sort_order: Number(row.sort_order),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class BoardDatabase {
  private db: Database | null = null;
  private dbPath: string | null = null;

  async init(dbPath: string): Promise<void> {
    this.dbPath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.getDb().run("PRAGMA foreign_keys = ON");
    this.persist();
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error("BoardDatabase not initialized");
    }
    return this.db;
  }

  private persist(): void {
    if (!this.db || !this.dbPath) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  private runMigrations(): void {
    const db = this.getDb();
    for (const sql of MIGRATIONS) {
      db.run(sql);
    }
    const versionResult = db.exec("SELECT version FROM schema_version LIMIT 1");
    if (versionResult.length === 0 || versionResult[0].values.length === 0) {
      db.run("INSERT INTO schema_version (version) VALUES (1)");
    }
  }

  close(): void {
    this.persist();
    this.db?.close();
    this.db = null;
  }

  listRepos(): BoardRepo[] {
    const db = this.getDb();
    const result = db.exec("SELECT * FROM repos ORDER BY name ASC");
    if (result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return rowToRepo(row);
    });
  }

  getRepo(id: number): BoardRepo | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM repos WHERE id = ?");
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToRepo(row);
  }

  getRepoByName(name: string): BoardRepo | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM repos WHERE name = ?");
    stmt.bind([name]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToRepo(row);
  }

  createRepo(input: CreateRepoInput): BoardRepo {
    const db = this.getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO repos (name, remote_url, secret_ref, local_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.name, input.remote_url, input.secret_ref, input.local_path ?? null, now, now],
    );
    const id = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number;
    this.persist();
    const repo = this.getRepo(id);
    if (!repo) throw new Error("Failed to create repo");
    return repo;
  }

  updateRepo(id: number, input: UpdateRepoInput): BoardRepo | null {
    const existing = this.getRepo(id);
    if (!existing) return null;

    const db = this.getDb();
    const now = new Date().toISOString();
    db.run(
      `UPDATE repos SET name = ?, remote_url = ?, secret_ref = ?, local_path = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name ?? existing.name,
        input.remote_url ?? existing.remote_url,
        input.secret_ref ?? existing.secret_ref,
        input.local_path !== undefined ? input.local_path : existing.local_path,
        now,
        id,
      ],
    );
    this.persist();
    return this.getRepo(id);
  }

  deleteRepo(id: number): boolean {
    const db = this.getDb();
    db.run("DELETE FROM repos WHERE id = ?", [id]);
    const changes = db.getRowsModified();
    this.persist();
    return changes > 0;
  }

  listCards(filters?: { repoId?: number; lane?: BoardLane }): BoardCard[] {
    const db = this.getDb();
    let sql = "SELECT * FROM cards WHERE 1=1";
    const params: (string | number)[] = [];

    if (filters?.repoId !== undefined) {
      sql += " AND repo_id = ?";
      params.push(filters.repoId);
    }
    if (filters?.lane !== undefined) {
      sql += " AND lane = ?";
      params.push(filters.lane);
    }
    sql += " ORDER BY sort_order ASC, id ASC";

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const cards: BoardCard[] = [];
    while (stmt.step()) {
      cards.push(rowToCard(stmt.getAsObject() as Record<string, unknown>));
    }
    stmt.free();
    return cards;
  }

  getCard(id: number): BoardCard | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM cards WHERE id = ?");
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToCard(row);
  }

  createCard(input: CreateCardInput): BoardCard {
    const lane = input.lane ?? "backlog";
    if (!BOARD_LANES.includes(lane)) {
      throw new Error(`Invalid lane: ${lane}`);
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO cards (repo_id, title, spec_markdown, lane, workflow, active_run_id, step_label, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.repo_id,
        input.title,
        input.spec_markdown,
        lane,
        input.workflow ?? null,
        input.active_run_id ?? null,
        input.step_label ?? null,
        input.sort_order ?? 0,
        now,
        now,
      ],
    );
    const id = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number;
    this.persist();
    const card = this.getCard(id);
    if (!card) throw new Error("Failed to create card");
    return card;
  }

  updateCard(id: number, input: UpdateCardInput): BoardCard | null {
    const existing = this.getCard(id);
    if (!existing) return null;

    if (input.lane !== undefined && !BOARD_LANES.includes(input.lane)) {
      throw new Error(`Invalid lane: ${input.lane}`);
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    db.run(
      `UPDATE cards SET title = ?, spec_markdown = ?, lane = ?, workflow = ?, active_run_id = ?,
       step_label = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [
        input.title ?? existing.title,
        input.spec_markdown ?? existing.spec_markdown,
        input.lane ?? existing.lane,
        input.workflow !== undefined ? input.workflow : existing.workflow,
        input.active_run_id !== undefined ? input.active_run_id : existing.active_run_id,
        input.step_label !== undefined ? input.step_label : existing.step_label,
        input.sort_order ?? existing.sort_order,
        now,
        id,
      ],
    );
    this.persist();
    return this.getCard(id);
  }

  deleteCard(id: number): boolean {
    const db = this.getDb();
    db.run("DELETE FROM cards WHERE id = ?", [id]);
    const changes = db.getRowsModified();
    this.persist();
    return changes > 0;
  }

  upsertCardByTitle(repoId: number, title: string, specMarkdown: string): BoardCard {
    const db = this.getDb();
    const stmt = db.prepare("SELECT id FROM cards WHERE repo_id = ? AND title = ? LIMIT 1");
    stmt.bind([repoId, title]);
    let existingId: number | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { id?: number };
      existingId = row.id != null ? Number(row.id) : null;
    }
    stmt.free();

    if (existingId) {
      const updated = this.updateCard(existingId, { spec_markdown: specMarkdown, title });
      const card = updated ?? this.getCard(existingId);
      if (!card) {
        throw new Error(`Card ${existingId} not found after update`);
      }
      return card;
    }
    return this.createCard({ repo_id: repoId, title, spec_markdown: specMarkdown });
  }
}

export const boardDb = new BoardDatabase();
