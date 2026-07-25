import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  title: z.string(),
  given: z.string().default("Context is established"),
  when: z.string().default("Action is executed"),
  then: z.string().default("Expected result is observed"),
  verificationStage: z.enum(["implement", "build", "test", "deploy", "review"]).default("test"),
});

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export const QualifiedSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string().default("1.0.0"),
  description: z.string().default(""),
  stages: z.array(z.string()).default(["implement", "build", "test", "deploy", "review"]),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  rawContent: z.string().optional(),
});

export type QualifiedSpec = z.infer<typeof QualifiedSpecSchema>;

export interface SpecValidationResult {
  valid: boolean;
  spec?: QualifiedSpec;
  errors?: string[];
}

export interface SpecSummary {
  id: string;
  title: string;
  version: string;
  path: string;
  valid: boolean;
}

/**
 * Parse YAML frontmatter key-values simply without external dependencies.
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const [, rawFrontmatter, body] = frontmatterMatch;
  const frontmatter: Record<string, string> = {};

  for (const line of rawFrontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val !== "null" && val !== "undefined") {
        frontmatter[key] = val;
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Parse Markdown spec into a QualifiedSpec object.
 */
export function parseSpecMarkdown(content: string): QualifiedSpec {
  const { frontmatter, body } = parseFrontmatter(content);

  // Fallback title from first h1
  const h1Match = body.match(/^#\s+(.+)$/m);
  const title = frontmatter.title || (h1Match ? h1Match[1].trim() : "Untitled Spec");
  const id = frontmatter.slug || frontmatter.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "spec-unknown";
  const version = frontmatter.version || "1.0.0";

  // Extract description section
  let description = "";
  const descMatch = body.match(/##\s+Description\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // Extract Acceptance Criteria
  const acceptanceCriteria: AcceptanceCriterion[] = [];
  const acSectionMatch = body.match(/##\s+Acceptance Criteria\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i);
  
  if (acSectionMatch) {
    const acSection = acSectionMatch[1];
    const acBlocks = acSection.split(/(?=###\s+AC\d+:)/i);

    for (const block of acBlocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;

      const headerMatch = trimmedBlock.match(/###\s+(AC\d+):\s*(.*)/i);
      const acId = headerMatch ? headerMatch[1].toUpperCase() : `AC${acceptanceCriteria.length + 1}`;
      const acTitle = headerMatch ? headerMatch[2].trim() : "Criteria";

      const givenMatch = trimmedBlock.match(/-\s*\*\*Given\*\*\s+(.*)/i);
      const whenMatch = trimmedBlock.match(/-\s*\*\*When\*\*\s+(.*)/i);
      const thenMatch = trimmedBlock.match(/-\s*\*\*Then\*\*\s+(.*)/i);

      acceptanceCriteria.push({
        id: acId,
        title: acTitle || "Acceptance Criterion",
        given: givenMatch ? givenMatch[1].trim() : "Context is defined",
        when: whenMatch ? whenMatch[1].trim() : "Action is performed",
        then: thenMatch ? thenMatch[1].trim() : "Outcome is verified",
        verificationStage: "test",
      });
    }
  }

  // Fallback criterion if none parsed
  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria.push({
      id: "AC1",
      title: "Default Feature Acceptance",
      given: "Feature specification exists",
      when: "Execution completes",
      then: "All requirements pass clean",
      verificationStage: "test",
    });
  }

  return QualifiedSpecSchema.parse({
    id,
    title,
    version,
    description,
    stages: ["implement", "build", "test", "deploy", "review"],
    acceptanceCriteria,
    dependencies: [],
    rawContent: content,
  });
}

/**
 * Validate raw string or object spec payload against QualifiedSpec schema.
 */
export function validateSpecPayload(input: unknown): SpecValidationResult {
  try {
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        return validateSpecPayload(parsed);
      }
      // Markdown string
      const spec = parseSpecMarkdown(trimmed);
      return { valid: true, spec };
    }

    if (typeof input === "object" && input !== null) {
      const parsed = QualifiedSpecSchema.safeParse(input);
      if (parsed.success) {
        return { valid: true, spec: parsed.data };
      }
      return {
        valid: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      };
    }

    return { valid: false, errors: ["Invalid spec payload format. Must be string or object."] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}

/**
 * Scan a repository for `.spec.md` files in `.cursor/specs` and `.agents/specs`.
 */
export function listRepoSpecs(repoPath: string): SpecSummary[] {
  const targetDirs = [
    path.join(repoPath, ".cursor", "specs"),
    path.join(repoPath, ".agents", "specs"),
    path.join(repoPath, "specs"),
  ];

  const results: SpecSummary[] = [];
  const seenPaths = new Set<string>();

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".spec.md") && !file.endsWith(".json")) continue;
        const fullPath = path.join(dir, file);
        if (seenPaths.has(fullPath)) continue;
        seenPaths.add(fullPath);

        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const validation = validateSpecPayload(content);

          if (validation.valid && validation.spec) {
            results.push({
              id: validation.spec.id,
              title: validation.spec.title,
              version: validation.spec.version,
              path: fullPath,
              valid: true,
            });
          } else {
            results.push({
              id: path.basename(file, path.extname(file)),
              title: file,
              version: "unknown",
              path: fullPath,
              valid: false,
            });
          }
        } catch {
          results.push({
            id: path.basename(file, path.extname(file)),
            title: file,
            version: "unknown",
            path: fullPath,
            valid: false,
          });
        }
      }
    } catch {
      // Ignore unreadable directory
    }
  }

  return results;
}
