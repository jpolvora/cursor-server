---
id: 16-runner-opencode
title: OpenCode Autonomous Coding Runner Adapter
slug: 16-runner-opencode
source: local
specDate: 2026-07-25
status: draft
version: 0.1.0
---

# OpenCode Autonomous Coding Runner Adapter

## Description
Implement an `OpenCodeRunner` adapter for OpenCode autonomous coding agent CLI. The adapter implements the `HarnessRunner` contract (`id: 'opencode'`), allowing `cursor-server` to execute `implement`, `build`, or `test` stages using OpenCode inside the local target repository working tree.

---

## Acceptance Criteria

### AC1: `OpenCodeRunner` Implementation
- **Given** `runnerRegistry` resolving `id: 'opencode'`,
- **When** `OpenCodeRunner.executeStage(input)` is called,
- **Then** it spawns OpenCode process execution in `input.repoPath` with specified prompts and options.

### AC2: Output Streaming & Log Capture
- **Given** OpenCode running a stage,
- **When** execution logs are produced,
- **Then** stdout/stderr streams are captured and reported in real-time to the `cursor-server` task/run stream.

### AC3: Result & Artifact Normalization
- **Given** OpenCode process exit,
- **When** evaluation completes,
- **Then** it converts exit code and git status changes into normalized `StageOutput`.

---

## Technical Guidance & Architecture
- Implement `OpenCodeRunner` in `src/services/opencode-runner.ts`.
- Register `'opencode'` in `runnerRegistry`.
