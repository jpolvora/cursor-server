import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { sanitizeCloneError } from "./board-secret.js";

const execFileAsync = promisify(execFile);

const CLONE_LOCK_STALE_MS = 15 * 60 * 1000;

function cloneLockPath(localPath: string): string {
  return `${localPath}.clone.lock`;
}

function isCloneLockStale(lockPath: string): boolean {
  try {
    const stat = fs.statSync(lockPath);
    return Date.now() - stat.mtimeMs > CLONE_LOCK_STALE_MS;
  } catch {
    return true;
  }
}

function acquireCloneLock(lockPath: string): number | null {
  try {
    return fs.openSync(lockPath, "wx");
  } catch {
    if (isCloneLockStale(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
        return fs.openSync(lockPath, "wx");
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function isCloneInProgress(localPath: string): boolean {
  const lockPath = cloneLockPath(localPath);
  if (!fs.existsSync(lockPath)) {
    return false;
  }
  if (isCloneLockStale(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore stale cleanup errors
    }
    return false;
  }
  return true;
}

export function resolveRepoLocalPath(
  reposRoot: string,
  name: string,
  localPath?: string | null,
): string {
  const canonicalRoot = path.resolve(reposRoot);
  const resolved =
    localPath && localPath.trim()
      ? path.resolve(localPath)
      : path.resolve(canonicalRoot, name);

  if (!resolved.startsWith(canonicalRoot + path.sep) && resolved !== canonicalRoot) {
    throw new Error("Invalid repository path (must stay under REPOS_ROOT)");
  }

  return resolved;
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

function buildCloneEnv(token: string): NodeJS.ProcessEnv {
  const authHeader = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: authHeader,
  };
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

  const lockPath = cloneLockPath(localPath);
  const lockFd = acquireCloneLock(lockPath);
  if (lockFd === null) {
    return { ok: false, error: "Clone already in progress for this repository" };
  }

  try {
    if (!isCloneMissingOrEmpty(localPath)) {
      return { ok: true };
    }

    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    try {
      await execFileAsync(
        "git",
        ["clone", "--depth", "1", remoteUrl, localPath],
        { env: buildCloneEnv(token) },
      );
      return { ok: true };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (fs.existsSync(localPath)) {
        try {
          fs.rmSync(localPath, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors after failed clone
        }
      }
      return { ok: false, error: sanitizeCloneError(raw) };
    }
  } finally {
    fs.closeSync(lockFd);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore stale lock cleanup errors
    }
  }
}

export function cleanupClone(localPath: string): { ok: true } | { ok: false; error: string } {
  if (isCloneInProgress(localPath)) {
    return { ok: false, error: "Clone in progress; try again later" };
  }
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
