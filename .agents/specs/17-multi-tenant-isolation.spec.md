---
id: 17-multi-tenant-isolation
title: Multi-Tenant Workspace & Security Isolation
slug: 17-multi-tenant-isolation
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Multi-Tenant Workspace & Security Isolation

## Description
Provide workspace isolation, process sandboxing, and access controls for multi-tenant deployments of `cursor-server`. Ensures distinct clients/users running tasks on the same homelab host cannot access, modify, or leak data across repo boundaries or execution contexts.

---

## Acceptance Criteria

### AC1: Tenant Authentication & Scope Enforcement
- **Given** client requests with tenant API keys or bearer tokens,
- **When** endpoints are accessed,
- **Then** `cursor-server` verifies tenant identity and restricts access strictly to allowed repositories in `REPOS_ROOT`.

### AC2: Execution Sandboxing & Resource Limits
- **Given** an agent task running for Tenant A,
- **When** process or tool execution occurs,
- **Then** execution is isolated to Tenant A's git working tree with CPU/Memory limits applied.

### AC3: Isolated Task History & Log Partitioning
- **Given** data queries to `GET /tasks` or `GET /harness/runs`,
- **When** requested by Tenant A,
- **Then** results are filtered strictly to Tenant A's tasks without revealing Tenant B metadata.

---

## Technical Guidance & Architecture
- Extend authentication middleware (`src/middleware/auth.ts`).
- Partition task storage and logs by `tenantId`.
