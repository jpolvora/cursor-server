import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertSafeSpecFilename,
  DEFAULT_SPEC_STAGES,
  listRepoSpecs,
  parseSpecMarkdown,
  readRepoSpecFile,
  validateSpecPayload,
  writeRepoSpecFile,
} from "./spec-schema.js";
import { LocalCursorRunner } from "./harness-runner.js";

describe("spec-schema", () => {
  it("parses markdown frontmatter and acceptance criteria", () => {
    const markdown = `---
slug: test-feature
title: Test Feature Spec
version: 1.2.0
---

# Test Feature Spec

## Description
This is a test description.

## Acceptance Criteria

### AC1: First Condition
- **Given** user is logged in
- **When** button is clicked
- **Then** modal opens

### AC2: Second Condition
- **Given** form is submitted
- **When** validation fails
- **Then** error alert displays
`;

    const spec = parseSpecMarkdown(markdown);
    assert.strictEqual(spec.id, "test-feature");
    assert.strictEqual(spec.title, "Test Feature Spec");
    assert.strictEqual(spec.version, "1.2.0");
    assert.strictEqual(spec.description, "This is a test description.");
    assert.strictEqual(spec.acceptanceCriteria.length, 2);
    assert.strictEqual(spec.acceptanceCriteria[0].id, "AC1");
    assert.strictEqual(spec.acceptanceCriteria[0].given, "user is logged in");
    assert.strictEqual(spec.acceptanceCriteria[0].when, "button is clicked");
    assert.strictEqual(spec.acceptanceCriteria[0].then, "modal opens");
    assert.deepStrictEqual(spec.stages, [...DEFAULT_SPEC_STAGES]);
  });

  it("parses frontmatter stages override", () => {
    const markdown = `---
slug: custom-stages
title: Custom Stages
stages: [implement, test, review]
---

# Custom Stages

## Description
Uses custom stages from frontmatter.
`;

    const spec = parseSpecMarkdown(markdown);
    assert.deepStrictEqual(spec.stages, ["implement", "test", "review"]);
  });

  it("parses frontmatter dependencies", () => {
    const markdown = `---
slug: with-deps
title: With Dependencies
dependencies:
  - spec-schema
  - auth
---

# With Dependencies

## Description
Depends on other specs.
`;

    const spec = parseSpecMarkdown(markdown);
    assert.deepStrictEqual(spec.dependencies, ["spec-schema", "auth"]);
  });

  it("falls back to default stages when frontmatter omits stages", () => {
    const markdown = `---
slug: no-stages
title: No Stages
---

# No Stages

## Description
No explicit stages.
`;

    const spec = parseSpecMarkdown(markdown);
    assert.deepStrictEqual(spec.stages, [...DEFAULT_SPEC_STAGES]);
  });

  it("default stages are supported by the default Cursor runner", () => {
    const runner = new LocalCursorRunner();
    const result = validateSpecPayload({ id: "defaults", title: "Defaults" });
    assert.strictEqual(result.valid, true);
    assert.ok(result.spec);
    for (const stage of result.spec!.stages) {
      assert.ok(
        runner.supportedStages.includes(stage as (typeof runner.supportedStages)[number]),
        `default stage '${stage}' must be supported by ${runner.id}`,
      );
    }
  });

  it("validates spec Markdown payload", () => {
    const markdown = `# Simple Spec\n\n## Description\nSimple spec test.`;
    const result = validateSpecPayload(markdown);
    assert.strictEqual(result.valid, true);
    assert.ok(result.spec);
    assert.strictEqual(result.spec.title, "Simple Spec");
  });

  it("validates spec JSON object payload", () => {
    const jsonPayload = {
      id: "json-spec",
      title: "JSON Spec Test",
      version: "1.0.0",
      description: "Parsed from JSON object",
      stages: ["implement", "build", "test"],
      acceptanceCriteria: [
        {
          id: "AC1",
          title: "Check JSON",
          given: "Valid JSON input",
          when: "Parsed by Zod",
          then: "Returns valid spec",
          verificationStage: "test",
        },
      ],
    };

    const result = validateSpecPayload(jsonPayload);
    assert.strictEqual(result.valid, true);
    assert.ok(result.spec);
    assert.strictEqual(result.spec.id, "json-spec");
  });

  it("returns structured validation errors for invalid objects", () => {
    const invalidPayload = {
      title: 123, // title must be string
    };

    const result = validateSpecPayload(invalidPayload);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors && result.errors.length > 0);
    assert.ok(result.issues && result.issues.length > 0);
    const titleIssue = result.issues!.find((issue) => issue.field === "title");
    assert.ok(titleIssue);
    assert.deepStrictEqual(titleIssue!.path, ["title"]);
    assert.strictEqual(titleIssue!.code, "invalid_type");
  });

  it("returns structured validation errors for invalid frontmatter stages", () => {
    const markdown = `---
slug: bad-stages
title: Bad Stages
stages: [implement, not-a-stage]
---

# Bad Stages
`;

    const result = validateSpecPayload(markdown);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues && result.issues.length > 0);
    const stageIssue = result.issues!.find((issue) => issue.path.includes("stages"));
    assert.ok(stageIssue);
    assert.ok(stageIssue!.message.length > 0);
  });

  it("scans repository specs directory", () => {
    const specs = listRepoSpecs(".");
    assert.strictEqual(Array.isArray(specs), true);
    assert.ok(specs.length > 0);
    assert.ok(specs.some((s) => s.id === "spec-schema"));
  });

  it("rejects path traversal in spec filenames", () => {
    for (const bad of ["../evil.spec.md", "..\\evil.spec.md", "a/b.spec.md", "a\\b.spec.md", ""]) {
      assert.throws(() => assertSafeSpecFilename(bad));
    }
  });

  it("accepts safe basename .spec.md filenames", () => {
    assert.strictEqual(assertSafeSpecFilename("14-spec-editor.spec.md"), "14-spec-editor.spec.md");
  });

  it("writes and reads a spec under .agents/specs (round-trip)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-io-"));
    try {
      const content = "---\nid: round-trip\ntitle: Round Trip\n---\n# Round Trip\n";
      const written = writeRepoSpecFile(tmp, "round-trip.spec.md", content);
      assert.strictEqual(written.path, ".agents/specs/round-trip.spec.md");
      assert.ok(fs.existsSync(path.join(tmp, ".agents", "specs", "round-trip.spec.md")));

      const read = readRepoSpecFile(tmp, "round-trip.spec.md");
      assert.strictEqual(read.content, content);
      assert.strictEqual(read.path, ".agents/specs/round-trip.spec.md");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects write when filename attempts traversal", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-io-bad-"));
    try {
      assert.throws(() => writeRepoSpecFile(tmp, "../escape.spec.md", "x"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
