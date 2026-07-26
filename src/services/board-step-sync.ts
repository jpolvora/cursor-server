import type { BoardLane } from "./board-db.js";

export type BoardWorkflow = "full" | "lite";

export interface LaneSyncResult {
  lane: BoardLane;
  stepLabel: string;
}

const SHIP_PATTERNS = [
  /\bship\b/i,
  /\bfix-pr\b/i,
  /\bstep[- ]?0[789]\b/i,
  /\bF[56]\b/,
  /\bstep[- ]?08\b/i,
  /\bstep[- ]?09\b/i,
];

const REVIEW_PATTERNS = [
  /\breview\b/i,
  /\bstep[- ]?06\b/i,
  /\bF4\b/,
  /\bstep[- ]?03\b/i, // lite review
];

const IMPLEMENT_PATTERNS = [
  /\bimplement/i,
  /\bstep[- ]?0[345]\b/i,
  /\bF[23]\b/,
];

const LITE_EARLY_PATTERNS = [/\bstep[- ]?0[12]\b/i];

const PLAN_PATTERNS = [/\bplan\b/i, /\bstep[- ]?0[12]\b/i, /\bF[01]\b/];

export function mapProgressHint(
  workflow: BoardWorkflow,
  hint: string,
  taskStatus?: string,
): LaneSyncResult {
  const text = hint.trim();
  const lower = text.toLowerCase();

  if (taskStatus === "failed" || taskStatus === "cancelled") {
    return { lane: "blocked", stepLabel: text || taskStatus };
  }

  if (taskStatus === "completed") {
    return { lane: "ship", stepLabel: text || "completed" };
  }

  for (const pattern of SHIP_PATTERNS) {
    if (pattern.test(text)) {
      return { lane: "ship", stepLabel: text || "ship" };
    }
  }

  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(text)) {
      return { lane: "review", stepLabel: text || "review" };
    }
  }

  if (workflow === "full") {
    for (const pattern of PLAN_PATTERNS) {
      if (pattern.test(text)) {
        return { lane: "implementing", stepLabel: text || "planning" };
      }
    }
  }

  for (const pattern of IMPLEMENT_PATTERNS) {
    if (pattern.test(text)) {
      return { lane: "implementing", stepLabel: text || "implementing" };
    }
  }

  if (workflow === "lite") {
    for (const pattern of LITE_EARLY_PATTERNS) {
      if (pattern.test(text)) {
        return { lane: "implementing", stepLabel: text || "implementing" };
      }
    }
  }

  if (lower.includes("queued")) {
    return { lane: "implementing", stepLabel: "queued" };
  }

  if (lower.includes("running") || lower.includes("started")) {
    return { lane: "implementing", stepLabel: text || "running" };
  }

  return { lane: "implementing", stepLabel: text || "in progress" };
}

export function extractStepHintFromOutput(chunk: string): string | null {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/step[- ]?\d+/i.test(line) || /\bF\d\b/.test(line)) return line;
    if (/\b(implement|review|ship|fix-pr|plan)\b/i.test(line)) return line;
  }
  return null;
}

export function buildTaskPrompt(
  specRelativePath: string,
  workflow: BoardWorkflow,
  flags?: string[],
): string {
  const base = workflow === "lite" ? "/ws-spec-to-pr-lite" : "/ws-spec-to-pr";
  const mode = flags?.length ? flags.join(" ") : "auto";
  return `${base} ${mode} ${specRelativePath}`;
}
