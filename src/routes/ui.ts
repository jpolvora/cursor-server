import { Hono } from "hono";

/**
 * Public UI routes (no auth). Browser calls protected APIs with optional X-API-Key.
 */
export function createUiRoutes() {
  const ui = new Hono();

  ui.get("/spec-editor", (c) => {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spec Editor — cursor-server</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4d;
      --text: #e7ecf3;
      --muted: #8b9bb4;
      --accent: #3d8bfd;
      --ok: #3dd68c;
      --bad: #f07178;
      --mono: "Cascadia Code", "Fira Code", ui-monospace, monospace;
      --sans: "Segoe UI", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: linear-gradient(160deg, #0f1419 0%, #15202b 55%, #0f1419 100%);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
    }
    header h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    header .sub { color: var(--muted); font-size: 0.85rem; }
    main {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: 0;
      min-height: calc(100vh - 64px);
    }
    @media (max-width: 800px) {
      main { grid-template-columns: 1fr; }
    }
    aside, section {
      padding: 1rem;
      border-right: 1px solid var(--border);
    }
    section { border-right: none; display: flex; flex-direction: column; gap: 0.75rem; }
    label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem; }
    input, textarea, button, select {
      font: inherit;
      color: var(--text);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.45rem 0.6rem;
    }
    input, textarea { width: 100%; }
    textarea {
      font-family: var(--mono);
      font-size: 0.85rem;
      line-height: 1.45;
      min-height: 420px;
      resize: vertical;
      flex: 1;
    }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end; }
    .row > div { flex: 1; min-width: 120px; }
    button {
      cursor: pointer;
      background: var(--accent);
      border-color: transparent;
      font-weight: 600;
      white-space: nowrap;
    }
    button.secondary { background: var(--panel); border-color: var(--border); }
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
    #spec-list li:hover { background: var(--panel); }
    #spec-list li.active { border-color: var(--accent); background: var(--panel); }
    #spec-list .invalid { color: var(--bad); }
    #status {
      font-family: var(--mono);
      font-size: 0.8rem;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      background: var(--panel);
      border: 1px solid var(--border);
      white-space: pre-wrap;
      min-height: 2.5rem;
    }
    #status.ok { border-color: var(--ok); color: var(--ok); }
    #status.bad { border-color: var(--bad); color: var(--bad); }
    #run-id { color: var(--accent); font-family: var(--mono); font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Spec Editor</h1>
      <div class="sub">cursor-server · validate · save · harness run</div>
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
      <label for="editor">Markdown spec</label>
      <textarea id="editor" spellcheck="false" placeholder="---&#10;id: my-feature&#10;title: My Feature&#10;---&#10;&#10;# My Feature&#10;&#10;## Description&#10;...&#10;&#10;## Acceptance Criteria&#10;&#10;### AC1: ...&#10;- **Given** ...&#10;- **When** ...&#10;- **Then** ..."></textarea>
      <div id="status" role="status">Idle — edit to validate</div>
      <div class="row">
        <button type="button" class="secondary" id="btn-validate">Validate</button>
        <button type="button" class="secondary" id="btn-save">Save</button>
        <button type="button" id="btn-save-run">Save &amp; Run</button>
      </div>
      <div id="run-id"></div>
    </section>
  </main>
  <script>
(function () {
  const KEY_STORAGE = "cursor-server-api-key";
  const REPO_STORAGE = "cursor-server-repo";

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
  };

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

  function repoName() {
    return el.repo.value.trim();
  }

  function ensureFilename() {
    let name = el.filename.value.trim();
    if (!name) {
      setStatus("Filename is required", "bad");
      return null;
    }
    if (!name.endsWith(".spec.md")) name += ".spec.md";
    el.filename.value = name;
    return name;
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    return { res: res, body: body };
  }

  async function listSpecs() {
    const repo = repoName();
    if (!repo) {
      setStatus("Enter a repository name", "bad");
      return;
    }
    sessionStorage.setItem(REPO_STORAGE, repo);
    const { res, body } = await api("/repos/" + encodeURIComponent(repo) + "/specs", {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus("List failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
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
    validateNow();
  }

  async function validateNow() {
    const content = el.editor.value;
    if (!content.trim()) {
      setStatus("Empty editor", "bad");
      return false;
    }
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
    const content = el.editor.value;
    const { res, body } = await api(
      "/repos/" + encodeURIComponent(repo) + "/specs/" + encodeURIComponent(file),
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ content: content }),
      }
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
    const repo = repoName();
    const { res, body } = await api("/harness/runs", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ spec: el.editor.value, repo: repo }),
    });
    if (!res.ok) {
      setStatus("Run failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    el.runId.textContent = "runId: " + body.runId + " (GET /harness/runs/" + body.runId + ")";
    setStatus("Saved & dispatched · " + body.runId, "ok");
  }

  let debounceTimer = null;
  el.editor.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { validateNow(); }, 300);
  });

  el.btnList.addEventListener("click", listSpecs);
  el.btnValidate.addEventListener("click", validateNow);
  el.btnSave.addEventListener("click", saveSpec);
  el.btnSaveRun.addEventListener("click", saveAndRun);

  if (repoName()) listSpecs();
})();
  </script>
</body>
</html>`);
  });

  return ui;
}
