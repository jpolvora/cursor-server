import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getMcpServerValidationError,
  isCommandResolvable,
  maskSensitiveEnv,
  resolveMcpForTask,
  resolveMcpServers,
  sanitizeMergedMcpServers,
  validateMcpServers,
} from "./mcp-config.js";

describe("mcp-config", () => {
  describe("resolveMcpServers merge order", () => {
    let reposRoot: string;
    let repoName: string;
    let globalConfigPath: string;
    let previousMcpConfigPath: string | undefined;

    beforeEach(() => {
      reposRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-merge-"));
      repoName = "test-repo";
      const repoPath = path.join(reposRoot, repoName);
      fs.mkdirSync(path.join(repoPath, ".cursor"), { recursive: true });

      globalConfigPath = path.join(os.tmpdir(), `mcp-global-${Date.now()}.json`);
      previousMcpConfigPath = process.env.MCP_CONFIG_PATH;
      process.env.MCP_CONFIG_PATH = globalConfigPath;

      fs.writeFileSync(
        globalConfigPath,
        JSON.stringify({ mcpServers: { global: { command: process.execPath } } }),
      );
      fs.writeFileSync(
        path.join(repoPath, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            repo: { command: process.execPath },
            shared: { command: process.execPath },
          },
        }),
      );
    });

    afterEach(() => {
      if (previousMcpConfigPath === undefined) {
        delete process.env.MCP_CONFIG_PATH;
      } else {
        process.env.MCP_CONFIG_PATH = previousMcpConfigPath;
      }
      fs.rmSync(reposRoot, { recursive: true, force: true });
      fs.rmSync(globalConfigPath, { force: true });
    });

    it("merges global, repo, and task override with override winning", () => {
      const resolved = resolveMcpServers(reposRoot, repoName, {
        shared: { command: process.execPath },
        taskOnly: { command: process.execPath },
      });

      assert.deepStrictEqual(Object.keys(resolved.merged).sort(), ["global", "repo", "shared", "taskOnly"]);
      assert.strictEqual(resolved.merged.global.command, process.execPath);
      assert.strictEqual(resolved.merged.repo.command, process.execPath);
      assert.strictEqual(resolved.merged.shared.command, process.execPath);
      assert.strictEqual(resolved.merged.taskOnly.command, process.execPath);
    });

    it("resolveMcpForTask loads global/repo when body override is omitted", () => {
      const merged = resolveMcpForTask(reposRoot, repoName);
      assert.ok(merged.global);
      assert.ok(merged.repo);
      assert.strictEqual(merged.shared.command, process.execPath);
    });
  });

  describe("validation and diagnostics", () => {
    it("rejects contradictory command+url", () => {
      const error = getMcpServerValidationError("bad", {
        command: "node",
        url: "http://localhost:3000",
      });
      assert.ok(error);
      assert.match(error!, /both command and url/);
      assert.strictEqual(
        validateMcpServers({ bad: { command: "node", url: "http://localhost:3000" } }),
        false,
      );
    });

    it("skips invalid stdio entries with a named warning", () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(" "));
      };

      try {
        const merged = sanitizeMergedMcpServers({
          good: { command: process.execPath },
          bad: { command: "node", url: "http://example.com" },
          missing: {},
        });

        assert.deepStrictEqual(Object.keys(merged), ["good"]);
        assert.ok(warnings.some((w) => w.includes('Skipping MCP server "bad"')));
        assert.ok(warnings.some((w) => w.includes('Skipping MCP server "missing"')));
      } finally {
        console.warn = originalWarn;
      }
    });

    it("skips unresolvable stdio commands with diagnostic warning", () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(" "));
      };

      try {
        const merged = sanitizeMergedMcpServers({
          ghost: { command: "definitely-not-a-real-mcp-binary-xyz" },
        });

        assert.deepStrictEqual(merged, {});
        assert.ok(warnings.some((w) => w.includes('MCP server "ghost"')));
        assert.ok(warnings.some((w) => w.includes("command not found")));
      } finally {
        console.warn = originalWarn;
      }
    });

    it("isCommandResolvable finds process.execPath", () => {
      assert.strictEqual(isCommandResolvable(process.execPath), true);
    });
  });

  describe("maskSensitiveEnv", () => {
    it("masks env and headers secrets", () => {
      const masked = maskSensitiveEnv({
        server: {
          command: "node",
          env: { API_KEY: "secret", EMPTY: "" },
          headers: { Authorization: "Bearer token" },
        },
      });

      assert.deepStrictEqual(masked.server.env, { API_KEY: "***", EMPTY: "" });
      assert.deepStrictEqual(masked.server.headers, { Authorization: "***" });
      assert.strictEqual(masked.server.command, "node");
    });
  });
});
