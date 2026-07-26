import { describe, it } from "node:test";
import assert from "node:assert";
import {
  applyTenantEnv,
  canAccessTenantResource,
  checkRepoAccess,
  listTenantFilter,
} from "./tenant-context.js";

describe("tenant-context", () => {
  it("checkRepoAccess denies unknown repo when allowlist is non-empty", () => {
    const err = checkRepoAccess(["repo-a"], "repo-b");
    assert.ok(err);
    assert.match(err!, /repo-b/);
  });

  it("checkRepoAccess allows any repo when allowlist is empty", () => {
    assert.strictEqual(checkRepoAccess([], "any-repo"), undefined);
  });

  it("canAccessTenantResource allows master cross-tenant access", () => {
    assert.strictEqual(canAccessTenantResource("master", "tenant-b"), true);
  });

  it("canAccessTenantResource denies cross-tenant for regular tenants", () => {
    assert.strictEqual(canAccessTenantResource("tenant-a", "tenant-b"), false);
    assert.strictEqual(canAccessTenantResource("tenant-a", "tenant-a"), true);
  });

  it("listTenantFilter returns undefined for master (see all)", () => {
    assert.strictEqual(listTenantFilter("master"), undefined);
    assert.strictEqual(listTenantFilter("anonymous"), undefined);
    assert.strictEqual(listTenantFilter("tenant-a"), "tenant-a");
  });

  it("applyTenantEnv sets and restores CURSOR_TENANT_ID and CURSOR_TENANT_REPO_PATH", () => {
    delete process.env.CURSOR_TENANT_ID;
    delete process.env.CURSOR_TENANT_REPO_PATH;

    const cleanup = applyTenantEnv({ tenantId: "tenant-a", repoPath: "/data/repos/foo" });
    assert.strictEqual(process.env.CURSOR_TENANT_ID, "tenant-a");
    assert.strictEqual(process.env.CURSOR_TENANT_REPO_PATH, "/data/repos/foo");

    cleanup();
    assert.strictEqual(process.env.CURSOR_TENANT_ID, undefined);
    assert.strictEqual(process.env.CURSOR_TENANT_REPO_PATH, undefined);
  });
});
