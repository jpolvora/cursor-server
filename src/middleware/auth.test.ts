import { describe, it } from "node:test";
import assert from "node:assert";
import type { Config } from "../config.js";
import { resolveTenant } from "./auth.js";

describe("resolveTenant", () => {
  const config: Config = {
    CURSOR_API_KEY: "cursor-key",
    PORT: 3000,
    HOST: "0.0.0.0",
    REPOS_ROOT: "./repos",
    BOARD_DB_PATH: "./data/test-board.db",
    CURSOR_MODEL: "composer-2",
    SERVER_API_KEY: "fake-master",
    TENANTS: [
      { id: "tenant-a", apiKey: "fake-a", allowedRepos: ["repo-a"] },
    ],
  };

  it("accepts master key via apiKey query param", () => {
    const { tenant, error } = resolveTenant(config, undefined, undefined, "fake-master");
    assert.strictEqual(error, undefined);
    assert.deepStrictEqual(tenant, { tenantId: "master", allowedRepos: [] });
  });

  it("accepts tenant key via access_token query param", () => {
    const { tenant, error } = resolveTenant(config, undefined, undefined, "fake-a");
    assert.strictEqual(error, undefined);
    assert.deepStrictEqual(tenant, {
      tenantId: "tenant-a",
      allowedRepos: ["repo-a"],
    });
  });

  it("prefers X-API-Key header over query param", () => {
    const { tenant } = resolveTenant(config, undefined, "fake-a", "fake-master");
    assert.strictEqual(tenant?.tenantId, "tenant-a");
  });

  it("rejects invalid query key", () => {
    const { tenant, error } = resolveTenant(config, undefined, undefined, "wrong-key");
    assert.strictEqual(tenant, null);
    assert.strictEqual(error, "Invalid API key");
  });
});
