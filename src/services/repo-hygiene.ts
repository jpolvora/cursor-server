import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type HygieneIssueKind =
  | "dirty_worktree"
  | "stale_branch"
  | "no_upstream"
  | "not_git_repo"
  | "scan_error";

export type HygieneIssue = {
  kind: HygieneIssueKind;
  message: string;
};

export type HygieneScanResult = {
  repoName: string;
  issues: HygieneIssue[];
};

export function listReposUnderRoot(reposRoot: string): string[] {
  if (!fs.existsSync(reposRoot)) {
    return [];
  }

  return fs.readdirSync(reposRoot).filter((entry) => {
    const full = path.join(reposRoot, entry);
    return fs.statSync(full).isDirectory();
  });
}

export async function scanRepoHygiene(
  repoPath: string,
  repoName: string,
): Promise<HygieneScanResult> {
  const gitPath = path.join(repoPath, ".git");
  if (!fs.existsSync(gitPath)) {
    return {
      repoName,
      issues: [{ kind: "not_git_repo", message: "Not a valid git working tree" }],
    };
  }

  const issues: HygieneIssue[] = [];

  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd: repoPath,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout.trim()) {
      const fileCount = stdout.trim().split("\n").length;
      issues.push({
        kind: "dirty_worktree",
        message: `Uncommitted changes detected (${fileCount} path(s) in git status --porcelain)`,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      repoName,
      issues: [{ kind: "scan_error", message: `git status failed: ${msg}` }],
    };
  }

  try {
    await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      { cwd: repoPath, timeout: 10_000 },
    );

    const { stdout: counts } = await execFileAsync(
      "git",
      ["rev-list", "--left-right", "--count", "HEAD...@{u}"],
      { cwd: repoPath, timeout: 10_000 },
    );
    const parts = counts.trim().split(/\s+/);
    const behind = Number(parts[1] ?? 0);
    if (behind > 0) {
      issues.push({
        kind: "stale_branch",
        message: `Branch is ${behind} commit(s) behind upstream`,
      });
    }
  } catch {
    issues.push({
      kind: "no_upstream",
      message: "Current branch has no upstream tracking branch",
    });
  }

  return { repoName, issues };
}

export function formatHygieneFindings(result: HygieneScanResult): string {
  if (result.issues.length === 0) {
    return `${result.repoName}: clean`;
  }

  const summary = result.issues.map((issue) => `${issue.kind}: ${issue.message}`).join("; ");
  return `${result.repoName}: ${summary}`;
}
