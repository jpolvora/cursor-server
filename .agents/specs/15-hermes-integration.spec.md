---
id: 15-hermes-integration
title: Hermes Agent Orchestration & Subagent Delegation
slug: 15-hermes-integration
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Hermes Agent Orchestration & Subagent Delegation

## Description
Integrate [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) into `cursor-server` as an alternate execution harness and high-level orchestrator. Hermes Agent provides persistent skills, subagent delegation, automated cron execution, and multi-step reasoning. This integration implements a `HermesRunner` adapter adhering to `HarnessRunner`, enabling `cursor-server` to delegate stage execution or overall pipeline orchestration to Hermes.

---

## Acceptance Criteria

### AC1: `HermesRunner` Adapter Implementation
- **Given** `runnerRegistry` resolving `id: 'hermes'`,
- **When** `HermesRunner.executeStage(input)` is called,
- **Then** it dispatches the stage execution request to the local or containerized Hermes Agent instance via CLI/RPC API.

### AC2: Subagent Delegation & Skill Loading
- **Given** a multi-step task requiring domain-specific subagents or skills,
- **When** Hermes Agent executes the stage,
- **Then** it dynamically loads required workflow skills and reports progress back to `cursor-server`.

### AC3: Normalized Stage Output & Logs
- **Given** Hermes Agent finishes stage execution,
- **When** response data is received,
- **Then** `HermesRunner` normalizes status, duration, stdout/stderr logs, and artifacts into standard `StageOutput`.

---

## Technical Guidance & Architecture
- Implement `HermesRunner` implementing `HarnessRunner` in `src/services/hermes-runner.ts`.
- Register `'hermes'` in `runnerRegistry`.
