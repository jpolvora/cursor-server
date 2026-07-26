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

  const lockPath = `${localPath}.clone.lock`;
  let lockFd: number | undefined;
  try {
    lockFd = fs.openSync(lockPath, "wx");
  } catch {
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
      return { ok: false, error: sanitizeCloneError(raw) };
    }
  } finally {
    if (lockFd !== undefined) {
      fs.closeSync(lockFd);
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore stale lock cleanup errors
    }
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
