---
id: null
title: MCP Server Configuration per Repo and Task
slug: mcp-config
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# MCP Server Configuration per Repo and Task

## Description
Provide Model Context Protocol (MCP) server configuration management for tasks executed on `cursor-server`. Support configuring external MCP servers at the global level, per-repository level (`{REPOS_ROOT}/{repo}/.cursor/mcp.json` or server config), and per-task override level in `POST /tasks`. Pass resolved MCP server specifications to agent runtimes (Cursor SDK, Hermes, etc.) during task execution.

---

## Acceptance Criteria

### AC1: Global and Per-Repo MCP Configuration Resolution
- **Given** `cursor-server` executes a task for a target repository,
- **When** the task initializes,
- **Then** `cursor-server` resolves MCP servers by merging:
  1. Global MCP config (optional `MCP_CONFIG_PATH` or default `config/mcp.json`).
  2. Repo-level MCP config (`{REPOS_ROOT}/{repo}/.cursor/mcp.json` or `.mcp.json`).
  3. Task payload `mcpServers` override object in `POST /tasks`.

### AC2: Task Request Payload MCP Overrides
- **Given** a client submits `POST /tasks`,
- **When** `mcpServers` object is provided in the JSON body,
- **Then** the endpoint validates the structure via Zod (`name`, `command`, `args`, `env`) and merges it into the task execution context.

### AC3: Pass MCP Config to Cursor SDK Runtime
- **Given** a task runs using the local Cursor SDK runtime,
- **When** `Agent.create` or `Agent.prompt` is called,
- **Then** the resolved MCP server configurations are injected into the agent runtime settings or environment options without leaking secrets or breaking non-MCP task runs.

### AC4: Error Handling and Fallback
- **Given** an invalid or non-existent MCP server command is configured,
- **When** the agent starts execution,
- **Then** `cursor-server` logs a clear diagnostic warning, isolated from causing host system crashes or corrupting task persistence states.

### AC5: API Endpoint for Listing Active MCP Config
- **Given** an authenticated caller queries `GET /repos/:repo/mcp`,
- **When** the request is authorized,
- **Then** it returns the resolved MCP server definitions available for that repository (with environment secrets masked).

---

## Notes & Technical Guidance
- Scope strictly covers MCP configuration resolution and runtime injection.
- Keep dependencies zero-heavy; use Zod for schema validation.
- Mask sensitive environment variables in `GET /repos/:repo/mcp`.
