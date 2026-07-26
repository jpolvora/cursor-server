/** Spec editor page — MVP Markdown + aspirational AC builder, stage designer, dependency graph. */

export const SPEC_EDITOR_STYLES = `
:root {
  --se-bg: #0f1419;
  --se-panel: #1a2332;
  --se-border: #2d3a4d;
  --se-text: #e7ecf3;
  --se-muted: #8b9bb4;
  --se-accent: #3d8bfd;
  --se-ok: #3dd68c;
  --se-bad: #f07178;
  --se-warn: #ffcc66;
  --se-mono: "Cascadia Code", "Fira Code", ui-monospace, monospace;
  --se-sans: "Segoe UI", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--se-sans);
  background: linear-gradient(160deg, #0f1419 0%, #15202b 55%, #0f1419 100%);
  color: var(--se-text);
  min-height: 100vh;
}
header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--se-border);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}
header h1 { margin: 0; font-size: 1.15rem; font-weight: 600; letter-spacing: 0.02em; }
header .sub { color: var(--se-muted); font-size: 0.85rem; }
main {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 0;
  min-height: calc(100vh - 64px);
}
@media (max-width: 800px) { main { grid-template-columns: 1fr; } }
aside, section {
  padding: 1rem;
  border-right: 1px solid var(--se-border);
}
section { border-right: none; display: flex; flex-direction: column; gap: 0.75rem; }
label { display: block; font-size: 0.75rem; color: var(--se-muted); margin-bottom: 0.25rem; }
input, textarea, button, select {
  font: inherit;
  color: var(--se-text);
  background: var(--se-panel);
  border: 1px solid var(--se-border);
  border-radius: 6px;
  padding: 0.45rem 0.6rem;
}
input, textarea { width: 100%; }
textarea#editor {
  font-family: var(--se-mono);
  font-size: 0.85rem;
  line-height: 1.45;
  min-height: 280px;
  resize: vertical;
  flex: 0 0 auto;
}
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; }
.row > div { flex: 1; min-width: 120px; }
button {
  cursor: pointer;
  background: var(--se-accent);
  border-color: transparent;
  font-weight: 600;
  white-space: nowrap;
}
button.secondary { background: var(--se-panel); border-color: var(--se-border); }
button.danger { background: #5c2b2f; border-color: var(--se-bad); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
#spec-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: 50vh;
  overflow: auto;
}
#spec-list li {
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  border: 1px solid transparent;
}
#spec-list li:hover { background: var(--se-panel); }
#spec-list li.active { border-color: var(--se-accent); background: var(--se-panel); }
#spec-list .invalid { color: var(--se-bad); }
#status {
  font-family: var(--se-mono);
  font-size: 0.8rem;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  background: var(--se-panel);
  border: 1px solid var(--se-border);
  white-space: pre-wrap;
  min-height: 2.5rem;
}
#status.ok { border-color: var(--se-ok); color: var(--se-ok); }
#status.bad { border-color: var(--se-bad); color: var(--se-bad); }
#run-id { color: var(--se-accent); font-family: var(--se-mono); font-size: 0.85rem; }
.se-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--se-border);
  padding-bottom: 0.35rem;
}
.se-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--se-muted);
  font-weight: 500;
  font-size: 0.8rem;
  padding: 0.35rem 0.65rem;
}
.se-tab.active {
  color: var(--se-text);
  border-color: var(--se-border);
  background: var(--se-panel);
}
.se-panel { display: none; }
.se-panel.active { display: block; }
.se-tool-panel {
  background: rgba(26, 35, 50, 0.45);
  border: 1px solid var(--se-border);
  border-radius: 8px;
  padding: 0.75rem;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
}
.ac-card {
  border: 1px solid var(--se-border);
  border-radius: 6px;
  padding: 0.6rem;
  margin-bottom: 0.5rem;
  background: var(--se-panel);
}
.ac-card header {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0;
  border: none;
  margin-bottom: 0.4rem;
}
.ac-card header input { flex: 1; font-weight: 600; }
.ac-card .ac-field { margin-bottom: 0.35rem; }
.ac-card .ac-field input { font-size: 0.85rem; }
.stage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.4rem;
}
.stage-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--se-border);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.stage-chip.on { border-color: var(--se-accent); background: rgba(61, 139, 253, 0.12); }
.stage-chip input { width: auto; margin: 0; }
#dep-graph {
  width: 100%;
  min-height: 200px;
  background: rgba(15, 20, 25, 0.5);
  border-radius: 6px;
  border: 1px solid var(--se-border);
}
.dep-legend { font-size: 0.75rem; color: var(--se-muted); margin-top: 0.5rem; }
.dep-issues { margin-top: 0.5rem; font-size: 0.8rem; }
.dep-issues .warn { color: var(--se-warn); }
.dep-issues .bad { color: var(--se-bad); }
`;

export const SPEC_EDITOR_CLIENT_JS = `
(function () {
  const KEY_STORAGE = "cursor-server-api-key";
  const REPO_STORAGE = "cursor-server-repo";
  const DEFAULT_STAGES = ["implement", "build", "test", "review"];
  const ALL_STAGES = ["spec", "implement", "build", "test", "deploy", "review"];

  const el = {
    repo: document.getElementById("repo"),
    apiKey: document.getElementById("api-key"),
    list: document.getElementById("spec-list"),
    filename: document.getElementById("filename"),
    editor: document.getElementById("editor"),
    status: document.getElementById("status"),
    runId: document.getElementById("run-id"),
    btnList: document.getElementById("btn-list"),
    btnValidate: document.getElementById("btn-validate"),
    btnSave: document.getElementById("btn-save"),
    btnSaveRun: document.getElementById("btn-save-run"),
    acList: document.getElementById("ac-list"),
    btnAddAc: document.getElementById("btn-add-ac"),
    stageGrid: document.getElementById("stage-grid"),
    depGraph: document.getElementById("dep-graph"),
    depIssues: document.getElementById("dep-issues"),
    tabs: document.querySelectorAll(".se-tab"),
    panels: document.querySelectorAll(".se-panel"),
  };

  let syncing = false;
  let knownSpecIds = [];
  let debounceTimer = null;

  el.apiKey.value = sessionStorage.getItem(KEY_STORAGE) || "";
  el.repo.value = sessionStorage.getItem(REPO_STORAGE) || "";

  el.apiKey.addEventListener("change", function () {
    sessionStorage.setItem(KEY_STORAGE, el.apiKey.value.trim());
  });
  el.repo.addEventListener("change", function () {
    sessionStorage.setItem(REPO_STORAGE, el.repo.value.trim());
  });

  function authHeaders() {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const key = el.apiKey.value.trim();
    if (key) {
      headers["X-API-Key"] = key;
      headers["Authorization"] = "Bearer " + key;
    }
    return headers;
  }

  function setStatus(text, kind) {
    el.status.textContent = text;
    el.status.className = kind || "";
  }

  function repoName() { return el.repo.value.trim(); }

  function ensureFilename() {
    let name = el.filename.value.trim();
    if (!name) { setStatus("Filename is required", "bad"); return null; }
    if (!name.endsWith(".spec.md")) name += ".spec.md";
    el.filename.value = name;
    return name;
  }

  async function api(path, options) {
    try {
      const res = await fetch(path, options);
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      return { res: res, body: body };
    } catch (err) {
      const message = err && err.message ? err.message : "Network request failed";
      return { res: { ok: false, status: 0 }, body: { error: message } };
    }
  }

  function unquoteYamlScalar(value) {
    let val = value.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    return val;
  }

  function parseInlineYamlArray(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map(function (item) { return unquoteYamlScalar(item); });
  }

  function parseFrontmatterLines(raw) {
    const frontmatter = {};
    let currentArrayKey = null;
    for (const line of raw.split("\\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const listMatch = trimmed.match(/^-\\s+(.+)$/);
      if (listMatch && currentArrayKey) {
        const existing = frontmatter[currentArrayKey];
        const item = unquoteYamlScalar(listMatch[1]);
        if (Array.isArray(existing)) existing.push(item);
        else frontmatter[currentArrayKey] = [item];
        continue;
      }
      currentArrayKey = null;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      const rawVal = trimmed.slice(colonIdx + 1).trim();
      if (rawVal === "" || rawVal === "null" || rawVal === "undefined") {
        if (rawVal === "null" || rawVal === "undefined") continue;
        currentArrayKey = key;
        frontmatter[key] = [];
        continue;
      }
      const inlineArray = parseInlineYamlArray(rawVal);
      if (inlineArray !== null) { frontmatter[key] = inlineArray; continue; }
      frontmatter[key] = unquoteYamlScalar(rawVal);
    }
    return frontmatter;
  }

  function splitSpec(content) {
    const match = content.match(/^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n?([\\s\\S]*)$/);
    if (!match) return { hasFm: false, frontmatter: {}, body: content };
    return { hasFm: true, frontmatter: parseFrontmatterLines(match[1]), body: match[2] };
  }

  function stringifyFrontmatter(fm) {
    const lines = [];
    const keys = Object.keys(fm);
    for (const key of keys) {
      const val = fm[key];
      if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(key + ":");
        } else if (val.length <= 4 && val.every(function (v) { return !/[\\s,\\[\\]]/.test(v); })) {
          lines.push(key + ": [" + val.join(", ") + "]");
        } else {
          lines.push(key + ":");
          val.forEach(function (item) { lines.push("  - " + item); });
        }
      } else if (val !== undefined && val !== null && val !== "") {
        const s = String(val);
        lines.push(key + ": " + (s.match(/[:#\\n]/) ? JSON.stringify(s) : s));
      }
    }
    return lines.join("\\n");
  }

  function assembleSpec(fm, body) {
    const fmText = stringifyFrontmatter(fm);
    if (!fmText.trim()) return body;
    return "---\\n" + fmText + "\\n---\\n" + body.replace(/^\\n+/, "");
  }

  function fmString(fm, key) {
    const v = fm[key];
    return typeof v === "string" ? v : undefined;
  }

  function fmArray(fm, key) {
    const v = fm[key];
    if (Array.isArray(v)) return v.slice();
    if (typeof v === "string" && v.trim()) return [v];
    return [];
  }

  function parseACs(body) {
    const acs = [];
    const acSectionMatch = body.match(/##\\s+Acceptance Criteria\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|$)/i);
    if (!acSectionMatch) return acs;
    const blocks = acSectionMatch[1].split(/(?=###\\s+AC\\d+:)/i);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const headerMatch = trimmed.match(/###\\s+(AC\\d+):\\s*(.*)/i);
      const id = headerMatch ? headerMatch[1].toUpperCase() : "AC" + (acs.length + 1);
      const title = headerMatch ? headerMatch[2].trim() : "Criteria";
      const givenMatch = trimmed.match(/-\\s*\\*\\*Given\\*\\*\\s+(.*)/i);
      const whenMatch = trimmed.match(/-\\s*\\*\\*When\\*\\*\\s+(.*)/i);
      const thenMatch = trimmed.match(/-\\s*\\*\\*Then\\*\\*\\s+(.*)/i);
      acs.push({
        id: id,
        title: title || "Acceptance Criterion",
        given: givenMatch ? givenMatch[1].trim() : "Context is defined",
        when: whenMatch ? whenMatch[1].trim() : "Action is performed",
        then: thenMatch ? thenMatch[1].trim() : "Outcome is verified",
      });
    }
    return acs;
  }

  function buildACSection(acs) {
    if (!acs.length) return "## Acceptance Criteria\\n\\n_(No criteria yet)_\\n";
    return "## Acceptance Criteria\\n\\n" + acs.map(function (ac) {
      return "### " + ac.id + ": " + ac.title + "\\n" +
        "- **Given** " + ac.given + "\\n" +
        "- **When** " + ac.when + "\\n" +
        "- **Then** " + ac.then;
    }).join("\\n\\n") + "\\n";
  }

  function replaceACSection(body, acs) {
    const acText = buildACSection(acs);
    if (/##\\s+Acceptance Criteria/i.test(body)) {
      return body.replace(/##\\s+Acceptance Criteria\\r?\\n[\\s\\S]*?(?=\\r?\\n##\\s+|$)/i, acText.trim() + "\\n");
    }
    const trimmed = body.trimEnd();
    return (trimmed ? trimmed + "\\n\\n" : "") + acText;
  }

  function currentSpecId(parts) {
    return fmString(parts.frontmatter, "slug") ||
      fmString(parts.frontmatter, "id") ||
      (el.filename.value || "current").replace(/\\.spec\\.md$/, "");
  }

  function applyToEditor(updater) {
    syncing = true;
    const parts = splitSpec(el.editor.value);
    const next = updater(parts);
    el.editor.value = assembleSpec(next.frontmatter, next.body);
    syncing = false;
    refreshPanels();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(validateNow, 300);
  }

  function renderACBuilder() {
    const parts = splitSpec(el.editor.value);
    const acs = parseACs(parts.body);
    el.acList.innerHTML = "";
    acs.forEach(function (ac, idx) {
      const card = document.createElement("div");
      card.className = "ac-card";
      card.innerHTML =
        '<header><input type="text" data-field="id" value="' + escapeAttr(ac.id) + '" style="max-width:4rem" />' +
        '<input type="text" data-field="title" value="' + escapeAttr(ac.title) + '" />' +
        '<button type="button" class="secondary btn-up" title="Move up">↑</button>' +
        '<button type="button" class="secondary btn-down" title="Move down">↓</button>' +
        '<button type="button" class="danger btn-del" title="Delete">×</button></header>' +
        '<div class="ac-field"><label>Given</label><input data-field="given" value="' + escapeAttr(ac.given) + '" /></div>' +
        '<div class="ac-field"><label>When</label><input data-field="when" value="' + escapeAttr(ac.when) + '" /></div>' +
        '<div class="ac-field"><label>Then</label><input data-field="then" value="' + escapeAttr(ac.then) + '" /></div>';
      card.querySelector(".btn-up").addEventListener("click", function () {
        if (idx === 0) return;
        const list = parseACs(splitSpec(el.editor.value).body);
        const tmp = list[idx - 1]; list[idx - 1] = list[idx]; list[idx] = tmp;
        applyToEditor(function (p) { return { frontmatter: p.frontmatter, body: replaceACSection(p.body, list) }; });
      });
      card.querySelector(".btn-down").addEventListener("click", function () {
        const list = parseACs(splitSpec(el.editor.value).body);
        if (idx >= list.length - 1) return;
        const tmp = list[idx + 1]; list[idx + 1] = list[idx]; list[idx] = tmp;
        applyToEditor(function (p) { return { frontmatter: p.frontmatter, body: replaceACSection(p.body, list) }; });
      });
      card.querySelector(".btn-del").addEventListener("click", function () {
        const list = parseACs(splitSpec(el.editor.value).body).filter(function (_, i) { return i !== idx; });
        applyToEditor(function (p) { return { frontmatter: p.frontmatter, body: replaceACSection(p.body, list) }; });
      });
      card.querySelectorAll("input").forEach(function (input) {
        input.addEventListener("change", function () {
          const list = parseACs(splitSpec(el.editor.value).body);
          const field = input.getAttribute("data-field");
          if (field && list[idx]) list[idx][field] = input.value.trim();
          applyToEditor(function (p) { return { frontmatter: p.frontmatter, body: replaceACSection(p.body, list) }; });
        });
      });
      el.acList.appendChild(card);
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function renderStageDesigner() {
    const parts = splitSpec(el.editor.value);
    const stages = fmArray(parts.frontmatter, "stages");
    const active = stages.length ? stages : DEFAULT_STAGES.slice();
    el.stageGrid.innerHTML = "";
    ALL_STAGES.forEach(function (stage) {
      const chip = document.createElement("label");
      chip.className = "stage-chip" + (active.indexOf(stage) >= 0 ? " on" : "");
      chip.innerHTML = '<input type="checkbox" data-stage="' + stage + '" ' +
        (active.indexOf(stage) >= 0 ? "checked" : "") + " /> " + stage;
      chip.querySelector("input").addEventListener("change", function (ev) {
        const checked = ev.target.checked;
        applyToEditor(function (p) {
          let list = fmArray(p.frontmatter, "stages");
          if (!list.length) list = DEFAULT_STAGES.slice();
          if (checked && list.indexOf(stage) < 0) list.push(stage);
          if (!checked) list = list.filter(function (s) { return s !== stage; });
          list = ALL_STAGES.filter(function (s) { return list.indexOf(s) >= 0; });
          if (!list.length) list = DEFAULT_STAGES.slice();
          p.frontmatter.stages = list;
          return p;
        });
      });
      el.stageGrid.appendChild(chip);
    });
  }

  function detectCycles(edges) {
    const graph = {};
    edges.forEach(function (e) {
      if (!graph[e.from]) graph[e.from] = [];
      graph[e.from].push(e.to);
    });
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    function dfs(node, stack) {
      if (visiting.has(node)) {
        const idx = stack.indexOf(node);
        if (idx >= 0) cycles.push(stack.slice(idx).concat(node));
        return;
      }
      if (visited.has(node)) return;
      visiting.add(node);
      stack.push(node);
      (graph[node] || []).forEach(function (n) { dfs(n, stack); });
      stack.pop();
      visiting.delete(node);
      visited.add(node);
    }
    Object.keys(graph).forEach(function (n) { dfs(n, []); });
    return cycles;
  }

  function renderDepGraph() {
    const parts = splitSpec(el.editor.value);
    const selfId = currentSpecId(parts);
    const deps = fmArray(parts.frontmatter, "dependencies");
    const nodes = [{ id: selfId, kind: "self" }];
    const edges = [];
    const missing = [];
    deps.forEach(function (dep) {
      const id = String(dep).trim();
      if (!id) return;
      nodes.push({ id: id, kind: knownSpecIds.indexOf(id) >= 0 ? "dep" : "missing" });
      edges.push({ from: selfId, to: id });
      if (knownSpecIds.indexOf(id) < 0 && knownSpecIds.length > 0) missing.push(id);
    });
    const cycles = detectCycles(edges);
    const svg = el.depGraph;
    const w = svg.clientWidth || 400;
    const h = 220;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = "";
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    const positions = {};
    positions[selfId] = { x: cx, y: cy };
    const others = nodes.filter(function (n) { return n.id !== selfId; });
    others.forEach(function (n, i) {
      const angle = (Math.PI * 2 * i) / Math.max(others.length, 1) - Math.PI / 2;
      positions[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
    edges.forEach(function (e) {
      const a = positions[e.from];
      const b = positions[e.to];
      if (!a || !b) return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(a.x));
      line.setAttribute("y1", String(a.y));
      line.setAttribute("x2", String(b.x));
      line.setAttribute("y2", String(b.y));
      line.setAttribute("stroke", "#3d8bfd");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("marker-end", "url(#arrow)");
      svg.appendChild(line);
    });
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = '<marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#3d8bfd"/></marker>';
    svg.appendChild(defs);
    nodes.forEach(function (n) {
      const pos = positions[n.id];
      if (!pos) return;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(pos.x));
      circle.setAttribute("cy", String(pos.y));
      circle.setAttribute("r", n.kind === "self" ? "28" : "22");
      circle.setAttribute("fill", n.kind === "missing" ? "#5c2b2f" : n.kind === "self" ? "#1e4a8a" : "#1a2332");
      circle.setAttribute("stroke", n.kind === "missing" ? "#f07178" : "#3d8bfd");
      circle.setAttribute("stroke-width", "2");
      g.appendChild(circle);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(pos.x));
      text.setAttribute("y", String(pos.y + 4));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#e7ecf3");
      text.setAttribute("font-size", "10");
      text.textContent = n.id.length > 12 ? n.id.slice(0, 10) + "…" : n.id;
      g.appendChild(text);
      svg.appendChild(g);
    });
    const issues = [];
    if (missing.length) issues.push('<span class="bad">Missing targets: ' + missing.join(", ") + "</span>");
    if (cycles.length) issues.push('<span class="warn">Cycle detected: ' + cycles.map(function (c) { return c.join(" → "); }).join("; ") + "</span>");
    if (!deps.length) issues.push('<span class="warn">No dependencies declared in frontmatter.</span>');
    el.depIssues.innerHTML = issues.join("<br/>");
  }

  function refreshPanels() {
    if (syncing) return;
    renderACBuilder();
    renderStageDesigner();
    renderDepGraph();
  }

  el.btnAddAc.addEventListener("click", function () {
    const list = parseACs(splitSpec(el.editor.value).body);
    const n = list.length + 1;
    list.push({
      id: "AC" + n,
      title: "New criterion",
      given: "Context is defined",
      when: "Action is performed",
      then: "Outcome is verified",
    });
    applyToEditor(function (p) { return { frontmatter: p.frontmatter, body: replaceACSection(p.body, list) }; });
  });

  el.tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      const target = tab.getAttribute("data-tab");
      el.tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
      el.panels.forEach(function (p) {
        p.classList.toggle("active", p.getAttribute("data-panel") === target);
      });
    });
  });

  async function listSpecs() {
    const repo = repoName();
    if (!repo) { setStatus("Enter a repository name", "bad"); return; }
    sessionStorage.setItem(REPO_STORAGE, repo);
    const { res, body } = await api("/repos/" + encodeURIComponent(repo) + "/specs", { headers: authHeaders() });
    if (!res.ok) {
      setStatus("List failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    knownSpecIds = (body.specs || []).map(function (s) { return s.id; }).filter(Boolean);
    el.list.innerHTML = "";
    (body.specs || []).forEach(function (s) {
      const li = document.createElement("li");
      const base = (s.path || "").split(/[/\\\\]/).pop() || s.id;
      li.textContent = (s.valid ? "" : "[invalid] ") + base + " — " + (s.title || "");
      if (!s.valid) li.classList.add("invalid");
      li.dataset.file = base;
      li.addEventListener("click", function () { openSpec(base, li); });
      el.list.appendChild(li);
    });
    setStatus("Listed " + (body.specs || []).length + " spec(s)", "ok");
    refreshPanels();
  }

  async function openSpec(file, li) {
    const repo = repoName();
    if (!repo) return;
    document.querySelectorAll("#spec-list li").forEach(function (n) { n.classList.remove("active"); });
    if (li) li.classList.add("active");
    el.filename.value = file;
    const { res, body } = await api(
      "/repos/" + encodeURIComponent(repo) + "/specs/" + encodeURIComponent(file),
      { headers: authHeaders() }
    );
    if (!res.ok) {
      setStatus("Open failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    el.editor.value = body.content || "";
    setStatus("Opened " + (body.path || file), "ok");
    refreshPanels();
    validateNow();
  }

  async function validateNow() {
    const content = el.editor.value;
    if (!content.trim()) { setStatus("Empty editor", "bad"); return false; }
    const { res, body } = await api("/specs/validate", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ content: content }),
    });
    if (res.ok && body && body.valid) {
      const id = body.spec && body.spec.id ? body.spec.id : "";
      setStatus("Valid" + (id ? " · id=" + id : ""), "ok");
      return true;
    }
    const errs = (body && body.errors) ? body.errors.join("\\n") : (body && body.error) || res.status;
    setStatus("Invalid:\\n" + errs, "bad");
    return false;
  }

  async function saveSpec() {
    const repo = repoName();
    const file = ensureFilename();
    if (!repo || !file) return false;
    const { res, body } = await api(
      "/repos/" + encodeURIComponent(repo) + "/specs/" + encodeURIComponent(file),
      { method: "PUT", headers: authHeaders(), body: JSON.stringify({ content: el.editor.value }) }
    );
    if (!res.ok) {
      const detail = body && (body.errors || body.error) ? JSON.stringify(body.errors || body.error) : res.status;
      setStatus("Save failed: " + detail, "bad");
      return false;
    }
    setStatus("Saved → " + (body.path || file), "ok");
    return true;
  }

  async function saveAndRun() {
    el.runId.textContent = "";
    const ok = await validateNow();
    if (!ok) return;
    const saved = await saveSpec();
    if (!saved) return;
    const { res, body } = await api("/harness/runs", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ spec: el.editor.value, repo: repoName() }),
    });
    if (!res.ok) {
      setStatus("Run failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    el.runId.textContent = "runId: " + body.runId + " (GET /harness/runs/" + body.runId + ")";
    setStatus("Saved & dispatched · " + body.runId, "ok");
  }

  el.editor.addEventListener("input", function () {
    if (syncing) return;
    refreshPanels();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(validateNow, 300);
  });

  el.btnList.addEventListener("click", listSpecs);
  el.btnValidate.addEventListener("click", validateNow);
  el.btnSave.addEventListener("click", saveSpec);
  el.btnSaveRun.addEventListener("click", saveAndRun);

  const params = new URLSearchParams(window.location.search);
  if (params.get("repo")) {
    el.repo.value = params.get("repo");
    sessionStorage.setItem(REPO_STORAGE, el.repo.value.trim());
  }
  if (params.get("file")) el.filename.value = params.get("file");
  if (repoName()) {
    if (params.get("file")) openSpec(params.get("file"));
    else listSpecs();
  } else {
    refreshPanels();
  }
})();
`;

export function renderSpecEditorPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spec Editor — cursor-server</title>
  <style>${SPEC_EDITOR_STYLES}</style>
</head>
<body>
  <header>
    <div>
      <h1>Spec Editor</h1>
      <div class="sub">cursor-server · validate · save · harness run ·
        <a href="/ui/prompt" style="color:var(--se-accent)">prompt</a> ·
        <a href="/ui/board" style="color:var(--se-accent)">board</a>
      </div>
    </div>
    <div class="row" style="flex: 1; max-width: 640px; justify-content: flex-end;">
      <div>
        <label for="repo">Repository</label>
        <input id="repo" placeholder="repo-name under REPOS_ROOT" autocomplete="off" />
      </div>
      <div>
        <label for="api-key">API key (optional)</label>
        <input id="api-key" type="password" placeholder="SERVER_API_KEY" autocomplete="off" />
      </div>
      <button type="button" class="secondary" id="btn-list">List specs</button>
    </div>
  </header>
  <main>
    <aside>
      <label>Specs in repo</label>
      <ul id="spec-list"></ul>
      <div style="margin-top: 1rem;">
        <label for="filename">Filename (.spec.md)</label>
        <input id="filename" placeholder="my-feature.spec.md" />
      </div>
    </aside>
    <section>
      <label for="editor">Markdown spec (source of truth)</label>
      <textarea id="editor" spellcheck="false" placeholder="---&#10;slug: my-feature&#10;title: My Feature&#10;---&#10;&#10;# My Feature&#10;&#10;## Description&#10;...&#10;&#10;## Acceptance Criteria&#10;&#10;### AC1: ...&#10;- **Given** ...&#10;- **When** ...&#10;- **Then** ..."></textarea>
      <div class="se-tabs" role="tablist">
        <button type="button" class="se-tab active" data-tab="markdown" role="tab">Markdown</button>
        <button type="button" class="se-tab" data-tab="ac-builder" role="tab">AC Builder</button>
        <button type="button" class="se-tab" data-tab="stages" role="tab">Stage Designer</button>
        <button type="button" class="se-tab" data-tab="deps" role="tab">Dependencies</button>
      </div>
      <div class="se-panel active" data-panel="markdown">
        <p style="font-size:0.8rem;color:var(--se-muted);margin:0.25rem 0 0">Edit raw Markdown above. Structured panels sync bidirectionally.</p>
      </div>
      <div class="se-panel se-tool-panel" data-panel="ac-builder">
        <div id="ac-list"></div>
        <button type="button" class="secondary" id="btn-add-ac">+ Add acceptance criterion</button>
      </div>
      <div class="se-panel se-tool-panel" data-panel="stages">
        <p style="font-size:0.8rem;color:var(--se-muted);margin:0 0 0.5rem">Toggle harness stages (default omits deploy).</p>
        <div id="stage-grid" class="stage-grid"></div>
      </div>
      <div class="se-panel se-tool-panel" data-panel="deps">
        <svg id="dep-graph" role="img" aria-label="Dependency graph"></svg>
        <div id="dep-issues" class="dep-issues"></div>
        <p class="dep-legend">Declare <code>dependencies:</code> in frontmatter. Red nodes = missing spec in repo.</p>
      </div>
      <div id="status" role="status">Idle — edit to validate</div>
      <div class="row">
        <button type="button" class="secondary" id="btn-validate">Validate</button>
        <button type="button" class="secondary" id="btn-save">Save</button>
        <button type="button" id="btn-save-run">Save &amp; Run</button>
      </div>
      <div id="run-id"></div>
    </section>
  </main>
  <script src="/ui/spec-editor-client.js"></script>
</body>
</html>`;
}
