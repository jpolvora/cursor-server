#!/usr/bin/env node
/**
 * Scan staged (or all tracked) files for hardcoded secrets before commit.
 * Used by husky pre-commit and `npm run scan-secrets`.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BLOCKED_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
]);

const SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".gz",
  ".pdf",
  ".lock",
]);

const SKIP_PATH_PREFIXES = [
  ".agents/skills/security-review/",
];

const PLACEHOLDER_RE =
  /(\.\.\.|xxx+|placeholder|changeme|your[-_]|example|<[^>]+>|REDACTED|fake|dummy|sample|insert[-_]?here|replace[-_]?me|todo|hardcoded|development-secret|FLAG|VULNERABLE|# SAFE)/i;

const RULES = [
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub PAT", regex: /ghp_[a-zA-Z0-9]{36,}/ },
  { name: "GitHub fine-grained PAT", regex: /github_pat_[a-zA-Z0-9_]{20,}/ },
  { name: "Cursor API key", regex: /cursor_[a-zA-Z0-9]{20,}/ },
  { name: "Slack token", regex: /xox[baprs]-[a-zA-Z0-9-]{10,}/ },
  { name: "Stripe live key", regex: /(?:sk|rk)_(?:live|test)_[a-zA-Z0-9]{16,}/ },
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Anthropic API key", regex: /sk-ant-api[0-9a-zA-Z_-]{20,}/ },
  { name: "OpenAI project key", regex: /sk-proj-[a-zA-Z0-9_-]{20,}/ },
  { name: "OpenAI API key", regex: /sk-[a-zA-Z0-9]{20,}T3BlbkFJ[a-zA-Z0-9]{20,}/ },
  { name: "Tailscale auth key", regex: /tskey-auth-[a-zA-Z0-9-]+/ },
  {
    name: "Assignment (api_key/secret/password/token)",
    regex:
      /(?:api[_-]?key|secret(?:[_-]?key)?|\bpassword\b|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"]([^'"]{12,})['"]/gi,
    capture: true,
  },
  {
    name: "Bearer token literal",
    regex: /Bearer\s+[a-zA-Z0-9._~+/=-]{20,}/,
  },
];

function runGit(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function shouldSkipFile(relPath) {
  const normalized = normalizeRepoPath(relPath);
  if (SKIP_PATH_PREFIXES.some((p) => normalized.startsWith(p))) return true;
  const parts = normalized.split("/");
  if (parts.some((p) => SKIP_DIRS.has(p))) return true;

  const ext = path.extname(normalized).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;

  const base = path.basename(normalized);
  if (BLOCKED_BASENAMES.has(base)) return true;

  return false;
}

function isAllowedLine(line, relPath) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
    if (PLACEHOLDER_RE.test(trimmed)) return true;
  }
  if (PLACEHOLDER_RE.test(line)) return true;
  if (relPath.endsWith(".env.example") && /=\s*['"]?[^'"]*(\.\.\.|xxx|placeholder|example)/i.test(line)) {
    return true;
  }
  if (/process\.env\.|import\.meta\.env\./.test(line)) return true;
  if (/z\.string\(\)|envSchema|loadConfig/.test(line) && !/[:=]\s*['"][^'"]{12,}['"]/.test(line)) {
    return true;
  }
  return false;
}

function isPlaceholderValue(value) {
  if (!value) return true;
  if (value.length < 12) return true;
  return PLACEHOLDER_RE.test(value);
}

function getFiles(mode) {
  if (mode === "all") {
    const out = runGit("ls-files");
    return out ? out.split("\n").filter(Boolean) : [];
  }
  const out = runGit("diff --cached --name-only --diff-filter=ACM");
  return out ? out.split("\n").filter(Boolean) : [];
}

function scanFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!existsSync(abs)) return [];

  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    return [];
  }

  const findings = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAllowedLine(line, relPath)) continue;

    for (const rule of RULES) {
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (rule.capture && match[1] && isPlaceholderValue(match[1])) continue;
        findings.push({
          file: relPath,
          line: i + 1,
          rule: rule.name,
          excerpt: line.trim().slice(0, 120),
        });
        if (!rule.regex.global) break;
      }
    }
  }

  return findings;
}

function main() {
  const mode = process.argv.includes("--all") ? "all" : "staged";
  const files = getFiles(mode).filter((f) => !shouldSkipFile(f));

  const blocked = getFiles(mode).filter((f) => BLOCKED_BASENAMES.has(path.basename(normalizeRepoPath(f))));
  const findings = [];

  for (const file of blocked) {
    findings.push({
      file,
      line: 0,
      rule: "Blocked env file",
      excerpt: "Do not commit .env files — use .env.example with placeholders",
    });
  }

  for (const file of files) {
    findings.push(...scanFile(file));
  }

  if (findings.length === 0) {
    console.log(`scan-secrets: OK (${mode}, ${files.length} file(s) checked)`);
    process.exit(0);
  }

  console.error(`scan-secrets: ${findings.length} issue(s) found (${mode}):\n`);
  for (const f of findings) {
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    console.error(`  [${f.rule}] ${loc}`);
    console.error(`    ${f.excerpt}\n`);
  }
  console.error("Fix: move secrets to .env (gitignored), use process.env, keep placeholders in .env.example only.");
  process.exit(1);
}

main();
