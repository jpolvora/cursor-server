import fs from "node:fs";
import path from "node:path";

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  type?: string;
  cwd?: string;
}

export type McpServers = Record<string, McpServerConfig>;

export interface ResolvedMcpConfig {
  global: McpServers;
  repo: McpServers;
  override: McpServers;
  merged: McpServers;
}

function loadJsonFile(filePath: string): McpServers {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.mcpServers === "object" && parsed.mcpServers !== null) {
      return parsed.mcpServers as McpServers;
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as McpServers;
    }
    return {};
  } catch (err) {
    console.warn(`[mcp-config] Failed to load ${filePath}:`, err);
    return {};
  }
}

export function resolveMcpServers(
  reposRoot: string,
  repo: string,
  overrides?: McpServers,
): ResolvedMcpConfig {
  const globalPath = process.env.MCP_CONFIG_PATH
    ? path.resolve(process.env.MCP_CONFIG_PATH)
    : path.resolve("config", "mcp.json");
  const global = loadJsonFile(globalPath);

  const repoDir = path.resolve(reposRoot, repo);
  const repoMcpPath = path.join(repoDir, ".cursor", "mcp.json");
  const repoAltPath = path.join(repoDir, ".mcp.json");
  const repoParsed = loadJsonFile(repoMcpPath);
  const repoAltParsed = Object.keys(repoParsed).length > 0 ? {} : loadJsonFile(repoAltPath);
  const repoConfig = { ...repoAltParsed, ...repoParsed };

  const override = overrides ?? {};

  const merged: McpServers = { ...global, ...repoConfig, ...override };

  return { global, repo: repoConfig, override, merged };
}

export function maskSensitiveEnv(servers: McpServers): McpServers {
  const masked: McpServers = {};
  for (const [name, config] of Object.entries(servers)) {
    if (config.env) {
      const maskedEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(config.env)) {
        maskedEnv[key] = value ? "***" : "";
      }
      masked[name] = { ...config, env: maskedEnv };
    } else {
      masked[name] = { ...config };
    }
  }
  return masked;
}

export function validateMcpServers(servers: unknown): servers is McpServers {
  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    return false;
  }
  for (const [name, config] of Object.entries(servers as Record<string, unknown>)) {
    if (typeof name !== "string" || !name) return false;
    if (typeof config !== "object" || config === null) return false;
    const c = config as Record<string, unknown>;
    if (c.command && (c.url || c.type === "http" || c.type === "sse")) {
      continue;
    }
    if (c.url && c.command) {
      return false;
    }
    if (c.command && typeof c.command !== "string") return false;
    if (c.args !== undefined && (!Array.isArray(c.args) || !c.args.every((a) => typeof a === "string"))) return false;
    if (c.env !== undefined && (typeof c.env !== "object" || c.env === null || Array.isArray(c.env))) return false;
    if (c.url !== undefined && typeof c.url !== "string") return false;
  }
  return true;
}
