import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { sanitizeCloneError } from "./board-secret.js";

const execFileAsync = promisify(execFile);

export function resolveRepoLocalPath(
  reposRoot: string,
  name: string,
  localPath?: string | null,
): string {
  if (localPath && localPath.trim()) {
    return path.resolve(localPath);
  }
  return path.resolve(reposRoot, name);
}

export function isCloneMissingOrEmpty(localPath: string): boolean {
  if (!fs.existsSync(localPath)) {
    return true;
  }
  try {
    const entries = fs.readdirSync(localPath);
    return entries.length === 0;
  } catch {
    return true;
  }
}

function buildAuthenticatedUrl(remoteUrl: string, token: string): string {
  try {
    const url = new URL(remoteUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "x-access-token";
      url.password = token;
      return url.toString();
    }
  } catch {
    // fall through
  }
  return remoteUrl;
}

export async function ensureClone(
  remoteUrl: string,
  localPath: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parent = path.dirname(localPath);
  fs.mkdirSync(parent, { recursive: true });

  if (!isCloneMissingOrEmpty(localPath)) {
    return { ok: true };
  }

  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }

  const cloneUrl = buildAuthenticatedUrl(remoteUrl, token);

  try {
    await execFileAsync("git", ["clone", "--depth", "1", cloneUrl, localPath], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: sanitizeCloneError(raw) };
  }
}

export function cleanupClone(localPath: string): { ok: true } | { ok: false; error: string } {
  if (!fs.existsSync(localPath)) {
    return { ok: true };
  }
  try {
    fs.rmSync(localPath, { recursive: true, force: true });
    return { ok: true };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: sanitizeCloneError(raw) };
  }
}
