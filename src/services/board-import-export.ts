import fs from "node:fs";
import path from "node:path";
import {
  agentsSpecsDir,
  assertSafeSpecFilename,
  parseSpecMarkdown,
  validateSpecPayload,
  writeRepoSpecFile,
} from "./spec-schema.js";
import type { BoardCard } from "./board-db.js";

export interface ImportResult {
  imported: Array<{ filename: string; cardId: number; title: string }>;
  errors: Array<{ filename: string; errors: string[] }>;
}

function assertRegularFile(filePath: string): void {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) {
    throw new Error("Symlinks are not allowed for spec files");
  }
  if (!stat.isFile()) {
    throw new Error("Spec path must be a regular file");
  }
}

export function importSpecsFromClone(clonePath: string, repoId: number, upsert: (repoId: number, title: string, specMarkdown: string) => BoardCard): ImportResult {
  const specsDir = agentsSpecsDir(clonePath);
  const result: ImportResult = { imported: [], errors: [] };

  if (!fs.existsSync(specsDir)) {
    return result;
  }

  const files = fs.readdirSync(specsDir).filter((f) => f.endsWith(".spec.md"));

  for (const filename of files) {
    try {
      assertSafeSpecFilename(filename);
    } catch {
      result.errors.push({ filename, errors: ["Invalid spec filename"] });
      continue;
    }

    const fullPath = path.join(specsDir, filename);
    let content: string;
    try {
      assertRegularFile(fullPath);
      content = fs.readFileSync(fullPath, "utf-8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ filename, errors: [message] });
      continue;
    }

    const validation = validateSpecPayload(content);
    if (!validation.valid) {
      result.errors.push({ filename, errors: validation.errors ?? ["Validation failed"] });
      continue;
    }

    const title = validation.spec?.title ?? filename.replace(/\.spec\.md$/, "");
    const card = upsert(repoId, title, content);
    result.imported.push({ filename, cardId: card.id, title });
  }

  return result;
}

export function exportCardSpec(clonePath: string, card: BoardCard): { filename: string; path: string } {
  const validation = validateSpecPayload(card.spec_markdown);
  if (!validation.valid) {
    throw Object.assign(new Error("Card spec_markdown is invalid"), {
      status: 422,
      errors: validation.errors,
      issues: validation.issues,
    });
  }

  let filename: string;
  try {
    const parsed = parseSpecMarkdown(card.spec_markdown);
    const slug = parsed.id || card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    filename = assertSafeSpecFilename(`${slug}.spec.md`);
  } catch {
    filename = assertSafeSpecFilename(`card-${card.id}.spec.md`);
  }

  const written = writeRepoSpecFile(clonePath, filename, card.spec_markdown);
  return { filename, path: written.path };
}
