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

function maskRecordValues(record: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    masked[key] = value ? "***" : "";
  }
  return masked;
}

export function maskSensitiveEnv(servers: McpServers): McpServers {
  const masked: McpServers = {};
  for (const [name, config] of Object.entries(servers)) {
    masked[name] = {
      ...config,
      ...(config.env ? { env: maskRecordValues(config.env) } : {}),
      ...(config.headers ? { headers: maskRecordValues(config.headers) } : {}),
    };
  }
  return masked;
}

function isRemoteMcpServer(config: McpServerConfig): boolean {
  return Boolean(
    config.url ||
      config.type === "http" ||
      config.type === "sse",
  );
}

export function getMcpServerValidationError(name: string, config: McpServerConfig): string | null {
  if (!name) {
    return "empty server name";
  }
  if (config.command && config.url) {
    return "cannot specify both command and url";
  }
  if (config.command && typeof config.command !== "string") {
    return "command must be a string";
  }
  if (config.args !== undefined && (!Array.isArray(config.args) || !config.args.every((a) => typeof a === "string"))) {
    return "args must be an array of strings";
  }
  if (config.env !== undefined && (typeof config.env !== "object" || config.env === null || Array.isArray(config.env))) {
    return "env must be an object";
  }
  if (config.headers !== undefined && (typeof config.headers !== "object" || config.headers === null || Array.isArray(config.headers))) {
    return "headers must be an object";
  }
  if (config.url !== undefined && typeof config.url !== "string") {
    return "url must be a string";
  }
  if (isRemoteMcpServer(config)) {
    if (!config.url) {
      return "remote MCP server requires url";
    }
    return null;
  }
  if (!config.command) {
    return "stdio MCP server requires command";
  }
  return null;
}

export function isCommandResolvable(command: string): boolean {
  if (path.isAbsolute(command)) {
    return fs.existsSync(command);
  }

  const pathEnv = process.env.PATH || process.env.Path || "";
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").map((ext) => ext.toLowerCase())
    : [""];

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      if (fs.existsSync(candidate)) {
        return true;
      }
    }
  }

  return false;
}

export function sanitizeMergedMcpServers(merged: McpServers): McpServers {
  const sanitized: McpServers = {};

  for (const [name, config] of Object.entries(merged)) {
    const validationError = getMcpServerValidationError(name, config);
    if (validationError) {
      console.warn(`[mcp-config] Skipping MCP server "${name}": ${validationError}`);
      continue;
    }

    if (config.command && !config.url && !isCommandResolvable(config.command)) {
      console.warn(
        `[mcp-config] MCP server "${name}": command not found on PATH or as absolute path: ${config.command}`,
      );
      continue;
    }

    sanitized[name] = config;
  }

  return sanitized;
}

export function resolveMcpForTask(
  reposRoot: string,
  repo: string,
  overrides?: McpServers,
): McpServers {
  const { merged } = resolveMcpServers(reposRoot, repo, overrides);
  return sanitizeMergedMcpServers(merged);
}

export function validateMcpServers(servers: unknown): servers is McpServers {
  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    return false;
  }
  for (const [name, config] of Object.entries(servers as Record<string, unknown>)) {
    if (typeof name !== "string" || !name) return false;
    if (typeof config !== "object" || config === null) return false;
    if (getMcpServerValidationError(name, config as McpServerConfig)) {
      return false;
    }
  }
  return true;
}
