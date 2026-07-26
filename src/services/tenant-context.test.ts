import { describe, it } from "node:test";
import assert from "node:assert";
import {
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
});
