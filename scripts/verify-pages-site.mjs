import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDir = resolve(root, "dist", "pages");

const [html, stylesheet] = await Promise.all([
  readFile(resolve(outputDir, "index.html"), "utf8"),
  readFile(resolve(outputDir, "styles.css"), "utf8"),
]);

assert.match(html, /<title>cursor-server \| Local-first agent execution<\/title>/);
assert.match(html, /href="\.\/styles\.css"/);
assert.match(html, /GitHub<\/a>/);
assert.ok(stylesheet.length > 0, "generated stylesheet must not be empty");

console.log("GitHub Pages site output verified");
