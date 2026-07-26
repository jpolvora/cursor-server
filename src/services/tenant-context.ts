import { createMiddleware } from "hono/factory";

export interface TenantVariables {
  tenantId: string;
  allowedRepos: string[];
}

export const tenantMiddleware = createMiddleware<{ Variables: TenantVariables }>(async (c, next) => {
  const tenantId = c.get("tenantId");
  if (!tenantId) {
    return c.json({ error: "No tenant context" }, 401);
  }
  return next();
});

export function enforceRepoSafety(allowedRepos: string[], repoName: string): boolean {
  if (allowedRepos.length === 0) return true;
  return allowedRepos.includes(repoName);
}

export function checkRepoAccess(allowedRepos: string[], repoName: string): string | undefined {
  if (allowedRepos.length === 0) return undefined;
  if (!allowedRepos.includes(repoName)) {
    return `Tenant does not have access to repository '${repoName}'`;
  }
  return undefined;
}
