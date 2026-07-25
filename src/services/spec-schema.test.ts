import { describe, it } from "node:test";
import assert from "node:assert";
import { parseSpecMarkdown, validateSpecPayload, listRepoSpecs } from "./spec-schema.js";

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

  it("returns validation error for invalid objects", () => {
    const invalidPayload = {
      title: 123, // title must be string
    };

    const result = validateSpecPayload(invalidPayload);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors && result.errors.length > 0);
  });

  it("scans repository specs directory", () => {
    const specs = listRepoSpecs(".");
    assert.strictEqual(Array.isArray(specs), true);
    assert.ok(specs.length > 0);
    assert.ok(specs.some((s) => s.id === "spec-schema"));
  });
});
