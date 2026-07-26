import type { Config } from "../config.js";

export interface TenantResourceLimits {
  cpuLimit?: number;
  memoryLimitMb?: number;
}

const ENV_CPU = "CURSOR_TENANT_CPU_LIMIT";
const ENV_MEMORY = "CURSOR_TENANT_MEMORY_LIMIT_MB";

export function resolveTenantResourceLimits(config: Config, tenantId?: string): TenantResourceLimits {
  const tenant = tenantId ? config.TENANTS.find((t) => t.id === tenantId) : undefined;
  return {
    cpuLimit: tenant?.cpuLimit ?? config.TENANT_CPU_LIMIT,
    memoryLimitMb: tenant?.memoryLimitMb ?? config.TENANT_MEMORY_LIMIT_MB,
  };
}

/**
 * Best-effort tenant resource limits for agent runs.
 * Sets CURSOR_TENANT_* env vars for the phase duration; OS-level cgroup
 * enforcement is recommended via Docker Compose deploy.resources limits.
 */
export function applyTenantResourceLimits(limits: TenantResourceLimits): () => void {
  const prevCpu = process.env[ENV_CPU];
  const prevMemory = process.env[ENV_MEMORY];

  if (limits.cpuLimit !== undefined) {
    process.env[ENV_CPU] = String(limits.cpuLimit);
  }
  if (limits.memoryLimitMb !== undefined) {
    process.env[ENV_MEMORY] = String(limits.memoryLimitMb);
  }

  return () => {
    if (limits.cpuLimit !== undefined) {
      if (prevCpu !== undefined) {
        process.env[ENV_CPU] = prevCpu;
      } else {
        delete process.env[ENV_CPU];
      }
    }
    if (limits.memoryLimitMb !== undefined) {
      if (prevMemory !== undefined) {
        process.env[ENV_MEMORY] = prevMemory;
      } else {
        delete process.env[ENV_MEMORY];
      }
    }
  };
}
