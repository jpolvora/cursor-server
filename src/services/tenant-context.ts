export interface TenantVariables {
  tenantId: string;
  allowedRepos: string[];
}

export function checkRepoAccess(allowedRepos: string[], repoName: string): string | undefined {
  if (allowedRepos.length === 0) return undefined;
  if (!allowedRepos.includes(repoName)) {
    return `Tenant does not have access to repository '${repoName}'`;
  }
  return undefined;
}

/** Master (and anonymous/no-auth) may access any tenant resource; others only their own. */
export function canAccessTenantResource(requestTenantId: string, resourceTenantId: string): boolean {
  if (requestTenantId === "master" || requestTenantId === "anonymous") {
    return true;
  }
  return requestTenantId === resourceTenantId;
}

/** When listing, master sees all tenants; others are scoped to their tenantId. */
export function listTenantFilter(requestTenantId: string | undefined): string | undefined {
  if (!requestTenantId || requestTenantId === "master" || requestTenantId === "anonymous") {
    return undefined;
  }
  return requestTenantId;
}

export function applyTenantEnv(input: { tenantId?: string; repoPath: string }): () => void {
  if (!input.tenantId) return () => {};

  const prevTenantId = process.env.CURSOR_TENANT_ID;
  const prevRepoPath = process.env.CURSOR_TENANT_REPO_PATH;

  process.env.CURSOR_TENANT_ID = input.tenantId;
  process.env.CURSOR_TENANT_REPO_PATH = input.repoPath;

  return () => {
    if (prevTenantId !== undefined) {
      process.env.CURSOR_TENANT_ID = prevTenantId;
    } else {
      delete process.env.CURSOR_TENANT_ID;
    }
    if (prevRepoPath !== undefined) {
      process.env.CURSOR_TENANT_REPO_PATH = prevRepoPath;
    } else {
      delete process.env.CURSOR_TENANT_REPO_PATH;
    }
  };
}
