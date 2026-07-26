import { describe, it } from "node:test";
import assert from "node:assert";
import type { Config } from "../config.js";
import { applyTenantResourceLimits, resolveTenantResourceLimits } from "./tenant-resource-limits.js";

describe("tenant-resource-limits", () => {
  const config: Config = {
    CURSOR_API_KEY: "test-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: "./repos",
    CURSOR_MODEL: "composer-2",
    TENANT_CPU_LIMIT: 0.5,
    TENANT_MEMORY_LIMIT_MB: 512,
    TENANTS: [
      {
        id: "tenant-a",
        apiKey: "key-a",
        allowedRepos: ["repo-a"],
        cpuLimit: 1,
        memoryLimitMb: 1024,
      },
    ],
  };

  it("resolveTenantResourceLimits uses per-tenant overrides when present", () => {
    const limits = resolveTenantResourceLimits(config, "tenant-a");
    assert.strictEqual(limits.cpuLimit, 1);
    assert.strictEqual(limits.memoryLimitMb, 1024);
  });

  it("resolveTenantResourceLimits falls back to global env defaults", () => {
    const limits = resolveTenantResourceLimits(config, "tenant-b");
    assert.strictEqual(limits.cpuLimit, 0.5);
    assert.strictEqual(limits.memoryLimitMb, 512);
  });

  it("applyTenantResourceLimits sets and restores CURSOR_TENANT_* env vars", () => {
    delete process.env.CURSOR_TENANT_CPU_LIMIT;
    delete process.env.CURSOR_TENANT_MEMORY_LIMIT_MB;

    const cleanup = applyTenantResourceLimits({ cpuLimit: 0.25, memoryLimitMb: 256 });
    assert.strictEqual(process.env.CURSOR_TENANT_CPU_LIMIT, "0.25");
    assert.strictEqual(process.env.CURSOR_TENANT_MEMORY_LIMIT_MB, "256");

    cleanup();
    assert.strictEqual(process.env.CURSOR_TENANT_CPU_LIMIT, undefined);
    assert.strictEqual(process.env.CURSOR_TENANT_MEMORY_LIMIT_MB, undefined);
  });
});
