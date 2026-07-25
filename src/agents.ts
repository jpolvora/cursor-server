/** Supported task agent roles. Unknown / missing values fall back to `default`. */
export const AGENTS = [
  "default",
  "planner",
  "implementer",
  "plan+implementer",
] as const;

export type AgentId = (typeof AGENTS)[number];

const AGENT_SET = new Set<string>(AGENTS);

/** Aliases normalized onto canonical ids before allowlist check. */
const ALIASES: Record<string, AgentId> = {
  generic: "default",
  plan_implementer: "plan+implementer",
  "plan-implementer": "plan+implementer",
  planimplementer: "plan+implementer",
};

export function isAgentId(value: string): value is AgentId {
  return AGENT_SET.has(value);
}

/**
 * Resolve a request `agent` value to a canonical id.
 * Missing, empty, or unknown values → `default` (generic).
 */
export function resolveAgent(value: unknown): AgentId {
  if (typeof value !== "string") {
    return "default";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "default";
  }

  const aliased = ALIASES[normalized] ?? normalized;
  return isAgentId(aliased) ? aliased : "default";
}
