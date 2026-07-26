import fs from "node:fs";
import path from "node:path";

export interface SecretResolution {
  ok: true;
  value: string;
}

export interface SecretResolutionError {
  ok: false;
  error: string;
}

export type ResolveSecretResult = SecretResolution | SecretResolutionError;

/**
 * Resolve a secret_ref by env var name or secrets file basename.
 * Never log or return resolved values outside this module's caller.
 */
export function resolveSecretRef(
  secretRef: string,
  secretsDir?: string,
): ResolveSecretResult {
  if (!secretRef || !secretRef.trim()) {
    return { ok: false, error: "secret_ref is required" };
  }

  const trimmed = secretRef.trim();

  const fromEnv = process.env[trimmed];
  if (fromEnv !== undefined && fromEnv !== "") {
    return { ok: true, value: fromEnv };
  }

  const fileCandidates: string[] = [];
  if (path.isAbsolute(trimmed)) {
    fileCandidates.push(trimmed);
  }
  if (secretsDir) {
    fileCandidates.push(path.join(secretsDir, trimmed));
  }
  fileCandidates.push(path.join("/run/secrets", trimmed));

  for (const candidate of fileCandidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const value = fs.readFileSync(candidate, "utf-8").trim();
        if (value) {
          return { ok: true, value };
        }
      }
    } catch {
      // try next candidate
    }
  }

  return { ok: false, error: `Unable to resolve secret_ref '${trimmed}'` };
}

/** Strip credential-like substrings from error messages before returning to clients. */
export function sanitizeCloneError(message: string): string {
  return message
    .replace(/https?:\/\/[^@\s]+@/gi, "https://***@")
    .replace(/x-access-token:[^@\s]+@/gi, "x-access-token:***@")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/token[=:]\S+/gi, "token=***");
}
