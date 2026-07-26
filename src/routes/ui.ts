import { Hono } from "hono";

/**
 * Public UI routes (no auth). Browser calls protected APIs with optional X-API-Key.
 */
export function createUiRoutes() {
  const ui = new Hono();

  ui.get("/board", (c) => {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Board — cursor-server</title>
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
      --warn: #ffcc66;
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
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { margin: 0; font-size: 1.15rem; font-weight: 600; }
    header .sub { color: var(--muted); font-size: 0.85rem; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: end;
    }
    label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.2rem; }
    input, select, button {
      font: inherit;
      color: var(--text);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.4rem 0.55rem;
    }
    button {
      cursor: pointer;
      background: var(--accent);
      border-color: transparent;
      font-weight: 600;
    }
    button.secondary { background: var(--panel); border-color: var(--border); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    #toast {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      max-width: 360px;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      font-size: 0.85rem;
      z-index: 100;
      display: none;
    }
    #toast.show { display: block; }
    #toast.bad { border-color: var(--bad); color: var(--bad); }
    #toast.ok { border-color: var(--ok); color: var(--ok); }
    .board-wrap {
      flex: 1;
      overflow: auto;
      padding: 0.75rem;
    }
    .board {
      display: flex;
      gap: 0.65rem;
      min-height: calc(100vh - 120px);
      align-items: stretch;
    }
    .column {
      flex: 0 0 220px;
      min-width: 200px;
      background: rgba(26, 35, 50, 0.55);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 100px);
    }
    .column.execution { opacity: 0.92; }
    .column-header {
      padding: 0.55rem 0.65rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: capitalize;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .column-header .count {
      font-weight: 400;
      color: var(--muted);
      font-size: 0.75rem;
    }
    .column-body {
      flex: 1;
      overflow-y: auto;
      padding: 0.45rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      min-height: 80px;
    }
    .column-body.drop-target { outline: 2px dashed var(--accent); outline-offset: -2px; }
    .column-body.drop-reject { outline: 2px dashed var(--bad); }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.55rem;
      font-size: 0.82rem;
      position: relative;
      cursor: default;
    }
    .card.draggable { cursor: grab; }
    .card.dragging { opacity: 0.45; }
    .card.locked { border-color: var(--warn); }
    .card-title { font-weight: 600; margin-bottom: 0.35rem; line-height: 1.3; }
    .badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.3rem; }
    .badge {
      font-size: 0.68rem;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      background: #243044;
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .badge.repo { color: var(--accent); }
    .badge.workflow-full { color: var(--ok); }
    .badge.workflow-lite { color: var(--warn); }
    .badge.run { color: var(--warn); border-color: var(--warn); }
    .step-chip {
      font-family: var(--mono);
      font-size: 0.68rem;
      color: var(--muted);
      margin-top: 0.15rem;
    }
    .card-menu-wrap { position: absolute; top: 0.35rem; right: 0.35rem; }
    .card-menu-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      padding: 0.15rem 0.35rem;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
    }
    .card-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 1.4rem;
      min-width: 160px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      z-index: 20;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    }
    .card-menu.open { display: block; }
    .card-menu button {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0.45rem 0.65rem;
      font-weight: 400;
      font-size: 0.8rem;
    }
    .card-menu button:hover:not(:disabled) { background: #243044; }
    .card-menu button:disabled { color: var(--muted); }
    .card-menu .sep { border-top: 1px solid var(--border); margin: 0.2rem 0; }
    #status-bar {
      padding: 0.35rem 1.25rem;
      font-size: 0.75rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
      font-family: var(--mono);
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Kanban Board</h1>
      <div class="sub">cursor-server · global ops · <a href="/ui/spec-editor" style="color:var(--accent)">spec-editor</a></div>
    </div>
    <div class="toolbar">
      <div>
        <label for="repo-filter">Repository</label>
        <select id="repo-filter"><option value="">All repos</option></select>
      </div>
      <div>
        <label for="api-key">API key</label>
        <input id="api-key" type="password" placeholder="SERVER_API_KEY" autocomplete="off" style="width: 160px;" />
      </div>
      <button type="button" class="secondary" id="btn-refresh">Refresh</button>
    </div>
  </header>
  <div class="board-wrap">
    <div class="board" id="board"></div>
  </div>
  <div id="status-bar">Loading…</div>
  <div id="toast" role="status"></div>
  <script>
(function () {
  const KEY_STORAGE = "cursor-server-api-key";
  const POLL_MS = 5000;
  const LANES = ["backlog","refine","ready","implementing","review","ship","done","paused","blocked"];
  const PLANNING_LANES = ["backlog","refine","ready"];
  const EXECUTION_LANES = ["implementing","review","ship","done","paused","blocked"];
  const LANE_LABELS = {
    backlog: "Backlog", refine: "Refine", ready: "Ready",
    implementing: "Implementing", review: "Review", ship: "Ship",
    done: "Done", paused: "Paused", blocked: "Blocked"
  };

  const el = {
    board: document.getElementById("board"),
    repoFilter: document.getElementById("repo-filter"),
    apiKey: document.getElementById("api-key"),
    btnRefresh: document.getElementById("btn-refresh"),
    statusBar: document.getElementById("status-bar"),
    toast: document.getElementById("toast"),
  };

  let repos = [];
  let cards = [];
  let pollTimer = null;
  let dragCardId = null;

  el.apiKey.value = sessionStorage.getItem(KEY_STORAGE) || "";
  el.apiKey.addEventListener("change", function () {
    sessionStorage.setItem(KEY_STORAGE, el.apiKey.value.trim());
  });

  function authHeaders() {
    const headers = { Accept: "application/json" };
    const key = el.apiKey.value.trim();
    if (key) {
      headers["X-API-Key"] = key;
      headers["Authorization"] = "Bearer " + key;
    }
    return headers;
  }

  function jsonHeaders() {
    return Object.assign({ "Content-Type": "application/json" }, authHeaders());
  }

  let toastTimer = null;
  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = "show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = ""; }, 4000);
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

  function repoById(id) {
    return repos.find(function (r) { return r.id === id; });
  }

  function deriveSpecFilename(specMarkdown) {
    if (!specMarkdown) return null;
    const m = specMarkdown.match(/^---\\s*\\n([\\s\\S]*?)\\n---/);
    if (m) {
      const idMatch = m[1].match(/^slug:\\s*(.+)$/m) || m[1].match(/^id:\\s*(.+)$/m);
      if (idMatch) {
        const slug = idMatch[1].trim().replace(/^["']|["']$/g, "");
        if (slug) return slug + ".spec.md";
      }
    }
    return null;
  }

  function buildColumns() {
    el.board.innerHTML = "";
    LANES.forEach(function (lane) {
      const col = document.createElement("div");
      col.className = "column" + (EXECUTION_LANES.includes(lane) ? " execution" : "");
      col.dataset.lane = lane;
      const hdr = document.createElement("div");
      hdr.className = "column-header";
      hdr.innerHTML = "<span>" + LANE_LABELS[lane] + "</span><span class=\\"count\\" data-lane-count=\\"" + lane + "\\">0</span>";
      const body = document.createElement("div");
      body.className = "column-body";
      body.dataset.lane = lane;
      if (PLANNING_LANES.includes(lane)) {
        body.addEventListener("dragover", onDragOver);
        body.addEventListener("dragleave", onDragLeave);
        body.addEventListener("drop", onDrop);
      }
      col.appendChild(hdr);
      col.appendChild(body);
      el.board.appendChild(col);
    });
  }

  function renderCards() {
    document.querySelectorAll(".column-body").forEach(function (b) { b.innerHTML = ""; });
    const counts = {};
    LANES.forEach(function (l) { counts[l] = 0; });

    cards.forEach(function (card) {
      const lane = card.lane || "backlog";
      if (!LANES.includes(lane)) return;
      counts[lane] = (counts[lane] || 0) + 1;
      const body = document.querySelector('.column-body[data-lane="' + lane + '"]');
      if (!body) return;
      body.appendChild(buildCardEl(card));
    });

    LANES.forEach(function (lane) {
      const c = document.querySelector('[data-lane-count="' + lane + '"]');
      if (c) c.textContent = String(counts[lane] || 0);
    });
  }

  function buildCardEl(card) {
    const repo = repoById(card.repo_id);
    const repoName = repo ? repo.name : "repo#" + card.repo_id;
    const locked = !!card.active_run_id;
    const canDrag = PLANNING_LANES.includes(card.lane) && !locked;

    const div = document.createElement("div");
    div.className = "card" + (canDrag ? " draggable" : "") + (locked ? " locked" : "");
    div.dataset.cardId = String(card.id);

    if (canDrag) {
      div.draggable = true;
      div.addEventListener("dragstart", function (e) {
        dragCardId = card.id;
        div.classList.add("dragging");
        e.dataTransfer.setData("text/plain", String(card.id));
        e.dataTransfer.effectAllowed = "move";
      });
      div.addEventListener("dragend", function () {
        dragCardId = null;
        div.classList.remove("dragging");
        document.querySelectorAll(".column-body").forEach(function (b) {
          b.classList.remove("drop-target", "drop-reject");
        });
      });
    }

    const menuWrap = document.createElement("div");
    menuWrap.className = "card-menu-wrap";
    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "card-menu-btn";
    menuBtn.textContent = "⋮";
    menuBtn.title = "Card menu";
    const menu = document.createElement("div");
    menu.className = "card-menu";

    function addMenuItem(label, fn, disabled) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (disabled) {
        btn.disabled = true;
        btn.title = "Available in execution control (spec 34)";
      } else {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          menu.classList.remove("open");
          fn();
        });
      }
      menu.appendChild(btn);
    }

    addMenuItem("Open in spec-editor", function () {
      const file = deriveSpecFilename(card.spec_markdown);
      const params = new URLSearchParams();
      params.set("repo", repoName);
      if (file) params.set("file", file);
      window.location.href = "/ui/spec-editor?" + params.toString();
    });
    menu.appendChild(document.createElement("div")).className = "sep";
    addMenuItem("Start", null, true);
    addMenuItem("Pause", null, true);
    addMenuItem("Finish", null, true);
    menu.appendChild(document.createElement("div")).className = "sep";
    addMenuItem("Export spec", function () { exportCard(card.id); });
    addMenuItem("Delete", function () {
      if (confirm("Delete card \\"" + card.title + "\\"?")) deleteCard(card.id);
    });

    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".card-menu.open").forEach(function (m) { m.classList.remove("open"); });
      menu.classList.toggle("open");
    });

    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(menu);

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.title;

    const badges = document.createElement("div");
    badges.className = "badges";
    const repoBadge = document.createElement("span");
    repoBadge.className = "badge repo";
    repoBadge.textContent = repoName;
    badges.appendChild(repoBadge);

    if (card.workflow) {
      const wf = document.createElement("span");
      wf.className = "badge workflow-" + (card.workflow === "lite" ? "lite" : "full");
      wf.textContent = card.workflow;
      badges.appendChild(wf);
    } else {
      const wf = document.createElement("span");
      wf.className = "badge";
      wf.textContent = "unset";
      badges.appendChild(wf);
    }

    if (locked) {
      const run = document.createElement("span");
      run.className = "badge run";
      run.textContent = "run active";
      badges.appendChild(run);
    }

    const step = document.createElement("div");
    step.className = "step-chip";
    step.textContent = card.step_label ? card.step_label : "—";

    div.appendChild(menuWrap);
    div.appendChild(title);
    div.appendChild(badges);
    div.appendChild(step);
    return div;
  }

  function onDragOver(e) {
    e.preventDefault();
    const lane = e.currentTarget.dataset.lane;
    if (!PLANNING_LANES.includes(lane)) {
      e.dataTransfer.dropEffect = "none";
      e.currentTarget.classList.add("drop-reject");
      return;
    }
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drop-target");
    e.currentTarget.classList.remove("drop-reject");
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove("drop-target", "drop-reject");
  }

  async function onDrop(e) {
    e.preventDefault();
    const lane = e.currentTarget.dataset.lane;
    e.currentTarget.classList.remove("drop-target", "drop-reject");
    const cardId = Number(e.dataTransfer.getData("text/plain") || dragCardId);
    if (!cardId) return;

    if (!PLANNING_LANES.includes(lane)) {
      toast("Cannot drop into " + LANE_LABELS[lane] + " — planning lanes only", "bad");
      return;
    }

    const card = cards.find(function (c) { return c.id === cardId; });
    if (!card) return;
    if (card.active_run_id) {
      toast("Card is run-locked", "bad");
      return;
    }
    if (card.lane === lane) return;

    const { res, body } = await api("/board/cards/" + cardId + "/move", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ lane: lane }),
    });
    if (!res.ok) {
      toast("Move failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    toast("Moved to " + LANE_LABELS[lane], "ok");
    await refresh();
  }

  async function exportCard(cardId) {
    const { res, body } = await api("/board/cards/" + cardId + "/export-spec", {
      method: "POST",
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      toast("Export failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    toast("Exported " + (body.filename || "spec"), "ok");
  }

  async function deleteCard(cardId) {
    const { res, body } = await api("/board/cards/" + cardId, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      toast("Delete failed: " + (body && body.error ? body.error : res.status), "bad");
      return;
    }
    toast("Card deleted", "ok");
    await refresh();
  }

  async function loadRepos() {
    const { res, body } = await api("/board/repos", { headers: authHeaders() });
    if (!res.ok) {
      throw new Error(body && body.error ? body.error : "repos " + res.status);
    }
    repos = body.repos || [];
    const prev = el.repoFilter.value;
    el.repoFilter.innerHTML = '<option value="">All repos</option>';
    repos.forEach(function (r) {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = r.name;
      el.repoFilter.appendChild(opt);
    });
    if (prev) el.repoFilter.value = prev;
  }

  async function loadCards() {
    let path = "/board/cards";
    const repoId = el.repoFilter.value;
    if (repoId) path += "?repoId=" + encodeURIComponent(repoId);
    const { res, body } = await api(path, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error(body && body.error ? body.error : "cards " + res.status);
    }
    cards = body.cards || [];
  }

  async function refresh() {
    try {
      await loadRepos();
      await loadCards();
      renderCards();
      el.statusBar.textContent = "Updated " + new Date().toLocaleTimeString() + " · " + cards.length + " card(s)";
    } catch (err) {
      el.statusBar.textContent = "Error: " + (err.message || err);
      toast(String(err.message || err), "bad");
    }
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, POLL_MS);
  }

  document.addEventListener("click", function () {
    document.querySelectorAll(".card-menu.open").forEach(function (m) { m.classList.remove("open"); });
  });

  el.repoFilter.addEventListener("change", refresh);
  el.btnRefresh.addEventListener("click", refresh);

  buildColumns();
  refresh();
  startPolling();
})();
  </script>
</body>
</html>`);
  });

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

  const params = new URLSearchParams(window.location.search);
  if (params.get("repo")) {
    el.repo.value = params.get("repo");
    sessionStorage.setItem(REPO_STORAGE, el.repo.value.trim());
  }
  if (params.get("file")) {
    el.filename.value = params.get("file");
  }
  if (repoName()) {
    if (params.get("file")) {
      openSpec(params.get("file"));
    } else {
      listSpecs();
    }
  }
})();
  </script>
</body>
</html>`);
  });

  return ui;
}
