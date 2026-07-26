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

