/** Root dashboard shell — login gate, left nav, pane soft-nav (see renderDashboardPageHtml). */

export function renderDashboardPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-density="comfortable">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cursor-server</title>
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
      --nav-width: 220px;
    }
    [data-theme="light"] {
      --bg: #f4f6f9;
      --panel: #ffffff;
      --border: #d0d7e2;
      --text: #1a2332;
      --muted: #5a6a82;
      --accent: #2563c7;
    }
    [data-density="compact"] {
      --nav-width: 180px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    #login-gate {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 20, 25, 0.92);
      padding: 1.25rem;
    }
    body.authed #login-gate { display: none; }
    body:not(.authed) #shell { visibility: hidden; pointer-events: none; }
    .login-dialog {
      width: min(380px, 100%);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem 1.35rem;
    }
    .login-dialog h1 {
      margin: 0 0 0.35rem;
      font-size: 1.25rem;
      font-weight: 650;
    }
    .login-dialog .sub {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem; }
    input, select, button {
      font: inherit;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.45rem 0.6rem;
    }
    input, select { width: 100%; }
    button {
      cursor: pointer;
      background: var(--accent);
      border-color: transparent;
      font-weight: 600;
      color: #fff;
    }
    button.secondary {
      background: var(--panel);
      border-color: var(--border);
      color: var(--text);
    }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    #login-error {
      color: var(--bad);
      font-size: 0.85rem;
      min-height: 1.2em;
      margin: 0.65rem 0 0;
    }
    .login-actions { margin-top: 0.85rem; display: flex; gap: 0.5rem; }
    #shell {
      display: grid;
      grid-template-columns: var(--nav-width) 1fr;
      min-height: 100vh;
    }
    aside.nav {
      border-right: 1px solid var(--border);
      background: var(--panel);
      padding: 0.85rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .brand {
      font-weight: 650;
      font-size: 0.95rem;
      padding: 0.35rem 0.55rem 0.75rem;
      letter-spacing: 0.01em;
    }
    .brand span { color: var(--muted); font-weight: 400; font-size: 0.75rem; display: block; }
    .nav-toggle {
      display: none;
      width: 100%;
      margin-bottom: 0.35rem;
    }
    .nav-links { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
    .nav-links a, .nav-links button.nav-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text);
      font-weight: 500;
      font-size: 0.9rem;
      padding: 0.5rem 0.6rem;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
    }
    .nav-links a:hover, .nav-links button.nav-item:hover {
      background: rgba(61, 139, 253, 0.08);
      text-decoration: none;
    }
    .nav-links a.active, .nav-links button.nav-item.active {
      border-color: var(--border);
      background: rgba(61, 139, 253, 0.12);
    }
    .nav-footer {
      padding: 0.5rem 0.35rem 0;
      border-top: 1px solid var(--border);
      margin-top: 0.5rem;
    }
    main#main-pane {
      padding: 1.25rem 1.5rem;
      overflow: auto;
    }
    .pane { display: none; max-width: 720px; }
    .pane.active { display: block; }
    .pane h2 { margin: 0 0 0.5rem; font-size: 1.35rem; font-weight: 650; }
    .pane p, .pane .muted { color: var(--muted); font-size: 0.92rem; line-height: 1.45; }
    .link-list { list-style: none; padding: 0; margin: 1rem 0; }
    .link-list li { margin: 0.35rem 0; }
    .cfg-form { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .cfg-row { display: flex; flex-direction: column; gap: 0.25rem; }
    .cfg-actions { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem; }
    #cfg-status { font-size: 0.8rem; color: var(--muted); font-family: var(--mono); }
    #cfg-status.ok { color: var(--ok); }
    #cfg-status.bad { color: var(--bad); }
    .projects-toolbar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin: 0.85rem 0 0.35rem;
    }
    #projects-list {
      list-style: none;
      padding: 0;
      margin: 1rem 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--panel);
    }
    #projects-list li {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }
    #projects-list li:last-child { border-bottom: none; }
    #projects-list li.muted { display: block; color: var(--muted); }
    #projects-list .row-main { flex: 1; min-width: 0; }
    #projects-list .remote { display: block; color: var(--muted); font-size: 0.75rem; margin-top: 0.15rem; word-break: break-all; }
    #projects-list .row-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
    #projects-list .row-actions button {
      font-size: 0.8rem;
      padding: 0.3rem 0.5rem;
      font-weight: 550;
    }
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 20, 25, 0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal.hidden { display: none; }
    .modal-panel {
      width: min(420px, 100%);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .modal-panel h2 { margin: 0; font-size: 1.05rem; font-weight: 650; }
    .modal-panel .sub { margin: 0; color: var(--muted); font-size: 0.85rem; }
    .modal-panel .cfg-row { display: flex; flex-direction: column; gap: 0.25rem; }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .modal-error {
      color: var(--bad);
      font-size: 0.85rem;
      min-height: 1.2em;
      margin: 0;
    }
    @media (max-width: 720px) {
      #shell { grid-template-columns: 1fr; }
      aside.nav {
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.65rem;
      }
      .nav-toggle { display: block; }
      aside.nav:not(.open) .nav-links { display: none; }
      aside.nav:not(.open) .nav-footer { display: none; }
      main#main-pane { padding: 1rem; }
    }
  </style>
</head>
<body>
  <div id="login-gate" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <div class="login-dialog">
      <h1 id="login-title">cursor-server</h1>
      <p class="sub">Enter your API key to open the ops dashboard.</p>
      <label for="login-api-key">API key</label>
      <input id="login-api-key" type="password" placeholder="SERVER_API_KEY or tenant key" autocomplete="off" />
      <p id="login-error" role="alert"></p>
      <div class="login-actions">
        <button type="button" id="btn-login">Sign in</button>
      </div>
    </div>
  </div>

  <div id="shell">
    <aside class="nav" id="side-nav">
      <div class="brand">cursor-server<span>ops console</span></div>
      <button type="button" class="secondary nav-toggle" id="btn-nav-toggle" aria-expanded="false">Menu</button>
      <nav class="nav-links" aria-label="Main">
        <button type="button" class="nav-item active" data-view="dashboard">Dashboard</button>
        <a href="/ui/board" data-nav="kanban">Kanban board</a>
        <button type="button" class="nav-item" data-view="projects">Projects</button>
        <button type="button" class="nav-item" data-view="config">Configuration</button>
      </nav>
      <div class="nav-footer">
        <button type="button" class="secondary" id="btn-logout" style="width:100%">Log out</button>
      </div>
    </aside>

    <main id="main-pane">
      <section class="pane active" id="pane-dashboard" data-pane="dashboard">
        <h2>Dashboard</h2>
        <p>Welcome to cursor-server. Use the left menu for board ops, project listing, and host configuration.</p>
        <ul class="link-list">
          <li><a href="/ui/board">Kanban board</a></li>
          <li><a href="/ui/prompt">Agent prompt</a></li>
          <li><a href="/ui/spec-editor">Spec editor</a></li>
        </ul>
      </section>

      <section class="pane" id="pane-projects" data-pane="projects">
        <h2>Projects</h2>
        <p class="muted">Create, edit, and delete board projects used by the Kanban board.</p>
        <div class="projects-toolbar">
          <button type="button" id="btn-project-new">New project</button>
        </div>
        <ul id="projects-list"></ul>
      </section>

      <section class="pane" id="pane-config" data-pane="config">
        <h2>Configuration</h2>
        <p class="muted">Host-level preferences stored in SQLite. Values apply on this server for all operators.</p>
        <form class="cfg-form" id="cfg-form">
          <div class="cfg-row">
            <label for="cfg-default_agent">default_agent</label>
            <select id="cfg-default_agent" name="default_agent">
              <option value="default">default</option>
              <option value="planner">planner</option>
              <option value="implementer">implementer</option>
              <option value="plan+implementer">plan+implementer</option>
              <option value="spec-to-pr">spec-to-pr</option>
              <option value="spec-to-pr-lite">spec-to-pr-lite</option>
            </select>
          </div>
          <div class="cfg-row">
            <label for="cfg-default_harness_runner">default_harness_runner</label>
            <select id="cfg-default_harness_runner" name="default_harness_runner">
              <option value="cursor-local">cursor-local</option>
              <option value="cursor-sdk">cursor-sdk</option>
              <option value="hermes">hermes</option>
              <option value="opencode">opencode</option>
            </select>
          </div>
          <div class="cfg-row">
            <label for="cfg-ui_theme">ui_theme</label>
            <select id="cfg-ui_theme" name="ui_theme">
              <option value="dark">dark</option>
              <option value="light">light</option>
            </select>
          </div>
          <div class="cfg-row">
            <label for="cfg-ui_density">ui_density</label>
            <select id="cfg-ui_density" name="ui_density">
              <option value="comfortable">comfortable</option>
              <option value="compact">compact</option>
            </select>
          </div>
          <div class="cfg-row">
            <label for="cfg-board_default_lane">board_default_lane</label>
            <select id="cfg-board_default_lane" name="board_default_lane">
              <option value="backlog">backlog</option>
              <option value="refine">refine</option>
              <option value="ready">ready</option>
              <option value="implementing">implementing</option>
              <option value="review">review</option>
              <option value="ship">ship</option>
              <option value="done">done</option>
              <option value="blocked">blocked</option>
              <option value="paused">paused</option>
            </select>
          </div>
          <div class="cfg-actions">
            <button type="submit" id="btn-cfg-save">Save</button>
            <span id="cfg-status"></span>
          </div>
        </form>
      </section>
    </main>
  </div>

  <div id="project-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
    <div class="modal-panel">
      <h2 id="project-modal-title">New project</h2>
      <div class="cfg-row">
        <label for="project-name">name</label>
        <input id="project-name" type="text" autocomplete="off" maxlength="128" />
      </div>
      <div class="cfg-row">
        <label for="project-remote-url">remote_url</label>
        <input id="project-remote-url" type="text" autocomplete="off" placeholder="https://… or git@…" />
      </div>
      <div class="cfg-row">
        <label for="project-secret-ref">secret_ref</label>
        <input id="project-secret-ref" type="text" autocomplete="off" placeholder="Env var name for clone credential" />
      </div>
      <p id="project-modal-error" class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="btn-project-cancel">Cancel</button>
        <button type="button" id="btn-project-save">Save</button>
      </div>
    </div>
  </div>

  <div id="project-delete-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="project-delete-title">
    <div class="modal-panel">
      <h2 id="project-delete-title">Delete project</h2>
      <p id="project-delete-message" class="sub">Delete this project? This cannot be undone.</p>
      <p id="project-delete-error" class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="btn-project-delete-cancel">Cancel</button>
        <button type="button" id="btn-project-delete-confirm">Delete</button>
      </div>
    </div>
  </div>

  <script>
(function () {
  const KEY_STORAGE = "cursor-server-api-key";

  const el = {
    loginKey: document.getElementById("login-api-key"),
    loginError: document.getElementById("login-error"),
    btnLogin: document.getElementById("btn-login"),
    btnLogout: document.getElementById("btn-logout"),
    btnNavToggle: document.getElementById("btn-nav-toggle"),
    sideNav: document.getElementById("side-nav"),
    cfgForm: document.getElementById("cfg-form"),
    cfgStatus: document.getElementById("cfg-status"),
    projectsList: document.getElementById("projects-list"),
    btnProjectNew: document.getElementById("btn-project-new"),
    projectModal: document.getElementById("project-modal"),
    projectModalTitle: document.getElementById("project-modal-title"),
    projectName: document.getElementById("project-name"),
    projectRemoteUrl: document.getElementById("project-remote-url"),
    projectSecretRef: document.getElementById("project-secret-ref"),
    projectModalError: document.getElementById("project-modal-error"),
    btnProjectCancel: document.getElementById("btn-project-cancel"),
    btnProjectSave: document.getElementById("btn-project-save"),
    projectDeleteModal: document.getElementById("project-delete-modal"),
    projectDeleteMessage: document.getElementById("project-delete-message"),
    projectDeleteError: document.getElementById("project-delete-error"),
    btnProjectDeleteCancel: document.getElementById("btn-project-delete-cancel"),
    btnProjectDeleteConfirm: document.getElementById("btn-project-delete-confirm"),
  };

  let projectsById = {};
  let editProjectId = null;
  let deleteProjectId = null;

  function authHeaders(key) {
    const k = key != null ? key : (sessionStorage.getItem(KEY_STORAGE) || "");
    const headers = { "Content-Type": "application/json" };
    if (k) {
      headers["X-API-Key"] = k;
      headers["Authorization"] = "Bearer " + k;
    }
    return headers;
  }

  function setAuthed(on) {
    document.body.classList.toggle("authed", !!on);
  }

  function showLoginError() {
    el.loginError.textContent = "Invalid or missing API key";
  }

  function clearLoginError() {
    el.loginError.textContent = "";
  }

  async function probe(key) {
    const res = await fetch("/settings", { headers: authHeaders(key) });
    return res;
  }

  function applyThemeDensity(settings) {
    const theme = settings.ui_theme || "dark";
    const density = settings.ui_density || "comfortable";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-density", density);
  }

  function fillConfigForm(settings) {
    const keys = [
      "default_agent",
      "default_harness_runner",
      "ui_theme",
      "ui_density",
      "board_default_lane",
    ];
    for (const key of keys) {
      const input = document.getElementById("cfg-" + key);
      if (input && settings[key] != null) input.value = settings[key];
    }
  }

  async function enterShell(settings) {
    setAuthed(true);
    clearLoginError();
    if (settings) {
      applyThemeDensity(settings);
      fillConfigForm(settings);
    }
    routeFromHash();
  }

  async function tryRestore() {
    const stored = sessionStorage.getItem(KEY_STORAGE) || "";
    el.loginKey.value = stored;
    try {
      const res = await probe(stored);
      if (res.status === 200) {
        const body = await res.json();
        await enterShell(body.settings || {});
        return;
      }
      if (res.status === 401 && stored) {
        showLoginError();
      }
    } catch (_) {
      /* stay gated */
    }
    setAuthed(false);
  }

  async function onLogin() {
    clearLoginError();
    const key = el.loginKey.value.trim();
    try {
      const res = await probe(key);
      if (res.status === 200) {
        sessionStorage.setItem(KEY_STORAGE, key);
        const body = await res.json();
        await enterShell(body.settings || {});
        return;
      }
      showLoginError();
    } catch (_) {
      showLoginError();
    }
  }

  function onLogout() {
    sessionStorage.removeItem(KEY_STORAGE);
    el.loginKey.value = "";
    clearLoginError();
    setAuthed(false);
    window.location.hash = "";
  }

  function setActiveView(view) {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    });
    document.querySelectorAll(".pane").forEach(function (pane) {
      pane.classList.toggle("active", pane.getAttribute("data-pane") === view);
    });
    if (view === "projects") loadProjects();
    if (view === "config") loadSettings();
  }

  function routeFromHash() {
    const hash = (window.location.hash || "#dashboard").replace(/^#/, "");
    if (hash === "kanban") {
      window.location.href = "/ui/board";
      return;
    }
    if (hash === "projects" || hash === "config" || hash === "dashboard") {
      setActiveView(hash);
      return;
    }
    setActiveView("dashboard");
  }

  async function loadSettings() {
    try {
      const res = await fetch("/settings", { headers: authHeaders() });
      if (res.status !== 200) return;
      const body = await res.json();
      fillConfigForm(body.settings || {});
      applyThemeDensity(body.settings || {});
    } catch (_) { /* ignore */ }
  }

  async function loadProjects() {
    el.projectsList.innerHTML = "<li class=\\"muted\\">Loading…</li>";
    try {
      const res = await fetch("/board/repos", { headers: authHeaders() });
      if (res.status !== 200) {
        el.projectsList.innerHTML = "<li class=\\"muted\\">Unable to load projects.</li>";
        return;
      }
      const body = await res.json();
      const repos = body.repos || [];
      projectsById = {};
      repos.forEach(function (r) { projectsById[r.id] = r; });
      if (!repos.length) {
        el.projectsList.innerHTML = "<li class=\\"muted\\">No projects yet.</li>";
        return;
      }
      el.projectsList.innerHTML = repos.map(function (r) {
        const remote = r.remote_url
          ? "<span class=\\"remote\\">" + escapeHtml(r.remote_url) + "</span>"
          : "";
        return (
          "<li data-id=\\"" + r.id + "\\">" +
            "<div class=\\"row-main\\">" + escapeHtml(r.name) + remote + "</div>" +
            "<div class=\\"row-actions\\">" +
              "<button type=\\"button\\" class=\\"secondary btn-project-edit\\" data-id=\\"" + r.id + "\\">Edit</button>" +
              "<button type=\\"button\\" class=\\"secondary btn-project-delete\\" data-id=\\"" + r.id + "\\">Delete</button>" +
            "</div>" +
          "</li>"
        );
      }).join("");
    } catch (_) {
      el.projectsList.innerHTML = "<li class=\\"muted\\">Unable to load projects.</li>";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resetProjectForm() {
    el.projectName.value = "";
    el.projectRemoteUrl.value = "";
    el.projectSecretRef.value = "";
    el.projectModalError.textContent = "";
    editProjectId = null;
  }

  function openProjectModal(mode, repo) {
    el.projectModalError.textContent = "";
    if (mode === "edit" && repo) {
      editProjectId = repo.id;
      el.projectModalTitle.textContent = "Edit project";
      el.projectName.value = repo.name || "";
      el.projectRemoteUrl.value = repo.remote_url || "";
      el.projectSecretRef.value = repo.secret_ref || "";
    } else {
      editProjectId = null;
      el.projectModalTitle.textContent = "New project";
      el.projectName.value = "";
      el.projectRemoteUrl.value = "";
      el.projectSecretRef.value = "";
    }
    el.projectModal.classList.remove("hidden");
    el.projectName.focus();
  }

  function closeProjectModal() {
    el.projectModal.classList.add("hidden");
    resetProjectForm();
  }

  function openDeleteModal(repo) {
    deleteProjectId = repo.id;
    el.projectDeleteError.textContent = "";
    el.projectDeleteMessage.textContent =
      "Delete project \\"" + (repo.name || "") + "\\"? This cannot be undone.";
    el.projectDeleteModal.classList.remove("hidden");
  }

  function closeDeleteModal() {
    el.projectDeleteModal.classList.add("hidden");
    el.projectDeleteError.textContent = "";
    deleteProjectId = null;
  }

  async function saveProject() {
    const name = el.projectName.value.trim();
    const remote_url = el.projectRemoteUrl.value.trim();
    const secret_ref = el.projectSecretRef.value.trim();
    el.projectModalError.textContent = "";
    if (!name || !remote_url || !secret_ref) {
      el.projectModalError.textContent = "name, remote_url, and secret_ref are required";
      return;
    }
    const payload = { name: name, remote_url: remote_url, secret_ref: secret_ref };
    el.btnProjectSave.disabled = true;
    try {
      const isEdit = editProjectId != null;
      const res = await fetch(
        isEdit ? "/board/repos/" + editProjectId : "/board/repos",
        {
          method: isEdit ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json().catch(function () { return {}; });
      if (res.status === 400 || res.status === 409) {
        el.projectModalError.textContent = body.error || "Request failed";
        return;
      }
      if (!(res.status === 200 || res.status === 201)) {
        el.projectModalError.textContent = body.error || ("Save failed (" + res.status + ")");
        return;
      }
      closeProjectModal();
      await loadProjects();
    } catch (_) {
      el.projectModalError.textContent = "Save failed";
    } finally {
      el.btnProjectSave.disabled = false;
    }
  }

  async function confirmDeleteProject() {
    if (deleteProjectId == null) return;
    el.projectDeleteError.textContent = "";
    el.btnProjectDeleteConfirm.disabled = true;
    try {
      const res = await fetch("/board/repos/" + deleteProjectId, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const body = await res.json().catch(function () { return {}; });
      if (res.status === 400 || res.status === 409) {
        el.projectDeleteError.textContent = body.error || "Delete failed";
        return;
      }
      if (res.status !== 200) {
        el.projectDeleteError.textContent = body.error || ("Delete failed (" + res.status + ")");
        return;
      }
      closeDeleteModal();
      await loadProjects();
    } catch (_) {
      el.projectDeleteError.textContent = "Delete failed";
    } finally {
      el.btnProjectDeleteConfirm.disabled = false;
    }
  }

  el.btnLogin.addEventListener("click", onLogin);
  el.loginKey.addEventListener("keydown", function (e) {
    if (e.key === "Enter") onLogin();
  });
  el.btnLogout.addEventListener("click", onLogout);
  el.btnNavToggle.addEventListener("click", function () {
    const open = el.sideNav.classList.toggle("open");
    el.btnNavToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  el.btnProjectNew.addEventListener("click", function () {
    openProjectModal("create");
  });
  el.btnProjectCancel.addEventListener("click", closeProjectModal);
  el.btnProjectSave.addEventListener("click", saveProject);
  el.btnProjectDeleteCancel.addEventListener("click", closeDeleteModal);
  el.btnProjectDeleteConfirm.addEventListener("click", confirmDeleteProject);

  el.projectsList.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const repo = projectsById[id];
    if (!repo) return;
    if (btn.classList.contains("btn-project-edit")) {
      openProjectModal("edit", repo);
      return;
    }
    if (btn.classList.contains("btn-project-delete")) {
      openDeleteModal(repo);
    }
  });

  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const view = btn.getAttribute("data-view");
      window.location.hash = view;
      setActiveView(view);
    });
  });

  window.addEventListener("hashchange", function () {
    if (!document.body.classList.contains("authed")) return;
    routeFromHash();
  });

  el.cfgForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    el.cfgStatus.textContent = "Saving…";
    el.cfgStatus.className = "";
    const settings = {
      default_agent: document.getElementById("cfg-default_agent").value,
      default_harness_runner: document.getElementById("cfg-default_harness_runner").value,
      ui_theme: document.getElementById("cfg-ui_theme").value,
      ui_density: document.getElementById("cfg-ui_density").value,
      board_default_lane: document.getElementById("cfg-board_default_lane").value,
    };
    try {
      const res = await fetch("/settings", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ settings: settings }),
      });
      if (res.status !== 200) {
        el.cfgStatus.textContent = "Save failed";
        el.cfgStatus.className = "bad";
        return;
      }
      const body = await res.json();
      applyThemeDensity(body.settings || settings);
      fillConfigForm(body.settings || settings);
      el.cfgStatus.textContent = "Saved";
      el.cfgStatus.className = "ok";
    } catch (_) {
      el.cfgStatus.textContent = "Save failed";
      el.cfgStatus.className = "bad";
    }
  });

  tryRestore();
})();
  </script>
</body>
</html>`;
}
