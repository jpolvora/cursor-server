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
