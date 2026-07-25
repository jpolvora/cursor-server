import fs from "node:fs";
import path from "node:path";

export interface RepoValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
  status?: number;
}

export function validateRepoPath(reposRoot: string, repoName: string): RepoValidationResult {
  const canonicalRoot = path.resolve(reposRoot);
  const targetPath = path.resolve(canonicalRoot, repoName);

  // Check path traversal
  if (!targetPath.startsWith(canonicalRoot + path.sep) && targetPath !== canonicalRoot) {
    return {
      valid: false,
      error: "Invalid repository path (path traversal detected)",
      status: 400,
    };
  }

  // Check directory existence
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
    return {
      valid: false,
      error: `Repository '${repoName}' not found`,
      status: 404,
    };
  }

  // Check git repository status (.git folder or file in case of git worktrees)
  const gitPath = path.join(targetPath, ".git");
  if (!fs.existsSync(gitPath)) {
    return {
      valid: false,
      error: `Repository '${repoName}' is not a valid git working tree`,
      status: 400,
    };
  }

  return {
    valid: true,
    resolvedPath: targetPath.replace(/\\/g, "/"),
  };
}
