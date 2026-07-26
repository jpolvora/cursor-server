/**
 * Shared operator shell — design tokens, left menu, top bar, main container.
 *
 * Every operator page is `renderShellPage(view)`: the shell supplies chrome and
 * the login gate, the view supplies only its body, scoped styles, and scripts.
 * Stylesheet and shell script are served once from /ui/app.css and /ui/app.js.
 */

export type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  group: string;
};

export const NAV_ITEMS: readonly ShellNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/", group: "Operations" },
  { id: "board", label: "Kanban board", href: "/ui/board", group: "Operations" },
  { id: "prompt", label: "Agent prompt", href: "/ui/prompt", group: "Operations" },
  { id: "specs", label: "Spec editor", href: "/ui/spec-editor", group: "Operations" },
  { id: "projects", label: "Projects", href: "/ui/projects", group: "Host" },
  { id: "config", label: "Configuration", href: "/ui/config", group: "Host" },
];

export type ShellView = {
  /** Nav item id to mark active. */
  viewId: string;
  /** Top bar heading and document title. */
  title: string;
  /** Optional top bar right-hand controls. */
  actions?: string;
  /** Main container markup. */
  body: string;
  /** View-scoped CSS, injected after the shared stylesheet. */
  styles?: string;
  /** Script URLs appended after the shell script (deferred, in order). */
  scripts?: string[];
  /** Markup appended after main (modals, toasts). */
  overlays?: string;
  /** Let the view own the full main container (no padding, own scrolling). */
  fill?: boolean;
};

export const APP_CSS = `:root {
  color-scheme: dark;
  --bg: #0f1419;
  --surface: #131a22;
  --panel: #1a2332;
  --panel-hover: #212c3c;
  --border: #26303f;
  --border-strong: #2d3a4d;
  --text: #e7ecf3;
  --muted: #8b9bb4;
  --faint: #6b7c93;
  --accent: #3d8bfd;
  --accent-soft: rgba(61, 139, 253, 0.14);
  --ok: #3dd68c;
  --bad: #f07178;
  --warn: #ffcc66;
  --mono: "Cascadia Code", "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --fs: 13px;
  --fs-sm: 12px;
  --fs-xs: 11px;
  --fs-lg: 15px;
  --nav-w: 208px;
  --topbar-h: 40px;
  --row-h: 28px;
  --r: 4px;
  --r-lg: 6px;
  --sp-1: 4px;
  --sp-2: 6px;
  --sp-3: 8px;
  --sp-4: 12px;
  --sp-5: 16px;
  --sp-6: 24px;
}

[data-theme="light"] {
  color-scheme: light;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --panel: #ffffff;
  --panel-hover: #eef1f5;
  --border: #dde2ea;
  --border-strong: #c6cedb;
  --text: #16202b;
  --muted: #5a6a82;
  --faint: #7b8798;
  --accent: #1f6feb;
  --accent-soft: rgba(31, 111, 235, 0.1);
}

[data-density="compact"] {
  --fs: 12px;
  --fs-sm: 11px;
  --nav-w: 184px;
  --topbar-h: 34px;
  --row-h: 24px;
  --sp-5: 12px;
  --sp-6: 16px;
}

* { box-sizing: border-box; }

html, body { height: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: var(--fs);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

code, kbd, samp, .mono { font-family: var(--mono); font-size: var(--fs-sm); }

h1, h2, h3 { margin: 0; font-weight: 600; line-height: 1.3; }
h2 { font-size: var(--fs-lg); }
h3 { font-size: var(--fs); }
p { margin: 0 0 var(--sp-4); }

label {
  display: block;
  font-size: var(--fs-xs);
  color: var(--muted);
  margin-bottom: var(--sp-1);
  letter-spacing: 0.01em;
}

input, select, textarea, button {
  font-family: inherit;
  font-size: var(--fs);
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 0 var(--sp-3);
  height: var(--row-h);
}

textarea { height: auto; padding: var(--sp-2) var(--sp-3); resize: vertical; }

input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}

button {
  cursor: pointer;
  background: var(--accent);
  border-color: transparent;
  color: #fff;
  font-weight: 500;
  padding: 0 var(--sp-4);
  white-space: nowrap;
}

button:hover:not(:disabled) { filter: brightness(1.08); }

button.secondary {
  background: var(--panel);
  border-color: var(--border-strong);
  color: var(--text);
  font-weight: 400;
}

button.secondary:hover:not(:disabled) { background: var(--panel-hover); filter: none; }

button.danger { background: transparent; border-color: var(--bad); color: var(--bad); font-weight: 400; }
button.danger:hover:not(:disabled) { background: rgba(240, 113, 120, 0.1); filter: none; }

button:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---- shell chrome ---- */

.app {
  display: grid;
  grid-template-columns: var(--nav-w) minmax(0, 1fr);
  height: 100vh;
}

body:not(.authed) .app { visibility: hidden; pointer-events: none; }

.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  height: var(--topbar-h);
  padding: 0 var(--sp-4);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs);
  font-weight: 600;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.brand .brand-sub {
  color: var(--faint);
  font-weight: 400;
  font-size: var(--fs-xs);
  margin-left: var(--sp-2);
}

.nav-toggle { display: none; }

.nav-links {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-3) var(--sp-2);
}

.nav-group-label {
  padding: var(--sp-3) var(--sp-3) var(--sp-1);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--faint);
}

.nav-links a {
  display: flex;
  align-items: center;
  height: var(--row-h);
  padding: 0 var(--sp-3);
  border-radius: var(--r);
  color: var(--muted);
  font-size: var(--fs);
  text-decoration: none;
}

.nav-links a:hover { background: var(--panel-hover); color: var(--text); text-decoration: none; }

.nav-links a[aria-current="page"] {
  background: var(--accent-soft);
  color: var(--text);
  font-weight: 500;
  box-shadow: inset 2px 0 0 var(--accent);
}

.nav-footer {
  flex-shrink: 0;
  padding: var(--sp-3);
  border-top: 1px solid var(--border);
}

.nav-footer button { width: 100%; }

.main-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  height: var(--topbar-h);
  padding: 0 var(--sp-5);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.topbar h1 {
  font-size: var(--fs);
  font-weight: 600;
  margin: 0;
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.topbar-input { width: 220px; }

.main-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--sp-5);
}

.main-pane.fill { padding: 0; overflow: hidden; display: flex; flex-direction: column; }

.view { max-width: 860px; }

.view-intro { color: var(--muted); margin-bottom: var(--sp-5); }

/* ---- primitives ---- */

.field { margin-bottom: var(--sp-4); }
.field input, .field select, .field textarea { width: 100%; }

.row { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: end; }

.actions { display: flex; align-items: center; gap: var(--sp-3); }

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}

.list li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.list li:last-child { border-bottom: none; }
.list li.empty { display: block; color: var(--muted); }
.list .row-main { min-width: 0; flex: 1; }
.list .row-sub { display: block; color: var(--faint); font-size: var(--fs-xs); font-family: var(--mono); word-break: break-all; }
.list .row-actions { display: flex; gap: var(--sp-2); flex-shrink: 0; }

.badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 var(--sp-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r);
  background: var(--panel);
  color: var(--muted);
  font-size: var(--fs-xs);
}

.status { font-family: var(--mono); font-size: var(--fs-sm); color: var(--muted); }
.status.ok { color: var(--ok); }
.status.bad { color: var(--bad); }
.status.warn { color: var(--warn); }

.modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  background: rgba(8, 12, 16, 0.7);
}

.modal.hidden { display: none; }

.modal-panel {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-5);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
}

.modal-panel h2 { font-size: var(--fs-lg); }
.modal-panel .sub { color: var(--muted); margin: 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-1); }
.modal-error { color: var(--bad); min-height: 1.2em; margin: 0; font-size: var(--fs-sm); }

/* ---- login gate ---- */

#login-gate {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  background: var(--bg);
}

body.authed #login-gate { display: none; }

.login-dialog {
  width: min(340px, 100%);
  padding: var(--sp-6);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
}

.login-dialog h1 { font-size: var(--fs-lg); margin-bottom: var(--sp-1); }
.login-dialog .sub { color: var(--muted); font-size: var(--fs-sm); margin-bottom: var(--sp-5); }
.login-dialog input { width: 100%; }
#login-error { color: var(--bad); font-size: var(--fs-sm); min-height: 1.2em; margin: var(--sp-3) 0 0; }
.login-actions { margin-top: var(--sp-4); }
.login-actions button { width: 100%; }

/* ---- narrow viewport ---- */

@media (max-width: 760px) {
  .app { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 100vh;
  }
  .nav-toggle {
    display: block;
    position: absolute;
    top: calc((var(--topbar-h) - var(--row-h)) / 2);
    right: var(--sp-3);
    width: auto;
  }
  .brand { position: relative; }
  .sidebar:not(.open) .nav-links,
  .sidebar:not(.open) .nav-footer { display: none; }
  .main-pane { padding: var(--sp-4); }
  .topbar { padding: 0 var(--sp-4); }
}
`;

export const APP_JS = `(function () {
  var KEY_STORAGE = "cursor-server-api-key";
  var LEGACY_HASH_ROUTES = {
    dashboard: "/",
    kanban: "/ui/board",
    board: "/ui/board",
    prompt: "/ui/prompt",
    specs: "/ui/spec-editor",
    projects: "/ui/projects",
    config: "/ui/config",
  };

  function storedKey() {
    try { return sessionStorage.getItem(KEY_STORAGE) || ""; } catch (_) { return ""; }
  }

  var auth = {
    authed: false,
    key: storedKey,
    headers: function (extra) {
      var headers = Object.assign({ Accept: "application/json" }, extra || {});
      var key = storedKey();
      if (key) {
        headers["X-API-Key"] = key;
        headers["Authorization"] = "Bearer " + key;
      }
      return headers;
    },
    jsonHeaders: function () {
      return auth.headers({ "Content-Type": "application/json" });
    },
    /** Run cb once the operator is past the login gate. */
    ready: function (cb) {
      if (auth.authed) { cb(); return; }
      document.addEventListener("cursor-server:authed", function () { cb(); }, { once: true });
    },
  };

  window.cursorServerAuth = auth;

  var gate = document.getElementById("login-gate");
  if (!gate) return;

  var loginKey = document.getElementById("login-api-key");
  var loginError = document.getElementById("login-error");
  var btnLogin = document.getElementById("btn-login");
  var btnLogout = document.getElementById("btn-logout");
  var sidebar = document.getElementById("sidebar");
  var btnNavToggle = document.getElementById("btn-nav-toggle");

  function applyPreferences(settings) {
    var root = document.documentElement;
    root.setAttribute("data-theme", (settings && settings.ui_theme) || "dark");
    root.setAttribute("data-density", (settings && settings.ui_density) || "comfortable");
  }

  function unlock(settings) {
    auth.authed = true;
    auth.settings = settings || {};
    loginError.textContent = "";
    document.body.classList.add("authed");
    applyPreferences(settings);
    document.dispatchEvent(
      new CustomEvent("cursor-server:authed", { detail: { settings: settings || {} } })
    );
  }

  function probe(key) {
    var headers = { Accept: "application/json" };
    if (key) {
      headers["X-API-Key"] = key;
      headers["Authorization"] = "Bearer " + key;
    }
    return fetch("/settings", { headers: headers });
  }

  async function attempt(key, reportFailure) {
    try {
      var res = await probe(key);
      if (res.status === 200) {
        var body = await res.json().catch(function () { return {}; });
        try { sessionStorage.setItem(KEY_STORAGE, key); } catch (_) { /* private mode */ }
        unlock(body.settings || {});
        return true;
      }
      if (reportFailure) loginError.textContent = "Invalid or missing API key";
    } catch (_) {
      if (reportFailure) loginError.textContent = "Invalid or missing API key";
    }
    document.body.classList.remove("authed");
    return false;
  }

  btnLogin.addEventListener("click", function () {
    attempt(loginKey.value.trim(), true);
  });

  loginKey.addEventListener("keydown", function (e) {
    if (e.key === "Enter") attempt(loginKey.value.trim(), true);
  });

  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      try { sessionStorage.removeItem(KEY_STORAGE); } catch (_) { /* private mode */ }
      auth.authed = false;
      loginKey.value = "";
      loginError.textContent = "";
      document.body.classList.remove("authed");
      loginKey.focus();
    });
  }

  if (btnNavToggle && sidebar) {
    btnNavToggle.addEventListener("click", function () {
      var open = sidebar.classList.toggle("open");
      btnNavToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Legacy hash deep links (#projects, #kanban, …) now map to real routes.
  var hash = (window.location.hash || "").replace(/^#/, "");
  if (hash && Object.prototype.hasOwnProperty.call(LEGACY_HASH_ROUTES, hash)) {
    var target = LEGACY_HASH_ROUTES[hash];
    if (target !== window.location.pathname) {
      window.location.replace(target);
      return;
    }
    history.replaceState(null, "", window.location.pathname);
  }

  var restored = storedKey();
  loginKey.value = restored;
  attempt(restored, !!restored);
})();
`;

function renderNav(activeId: string): string {
  const groups: string[] = [];
  let currentGroup = "";
  let buffer = "";

  const flush = () => {
    if (buffer) groups.push(buffer);
    buffer = "";
  };

  for (const item of NAV_ITEMS) {
    if (item.group !== currentGroup) {
      flush();
      currentGroup = item.group;
      buffer = `        <div class="nav-group-label">${item.group}</div>\n`;
    }
    const current = item.id === activeId ? ' aria-current="page"' : "";
    buffer += `        <a href="${item.href}" data-nav="${item.id}"${current}>${item.label}</a>\n`;
  }
  flush();

  return groups.join("");
}

export function renderShellPage(view: ShellView): string {
  const scripts = ["/ui/app.js", ...(view.scripts ?? [])]
    .map((src) => `  <script src="${src}" defer></script>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-density="comfortable">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${view.title} — cursor-server</title>
  <link rel="stylesheet" href="/ui/app.css" />
${view.styles ? `  <style>${view.styles}</style>\n` : ""}</head>
<body>
  <div id="login-gate" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <div class="login-dialog">
      <h1 id="login-title">cursor-server</h1>
      <p class="sub">Enter your API key to open the ops console.</p>
      <label for="login-api-key">API key</label>
      <input id="login-api-key" type="password" placeholder="SERVER_API_KEY or tenant key" autocomplete="off" />
      <p id="login-error" role="alert"></p>
      <div class="login-actions">
        <button type="button" id="btn-login">Sign in</button>
      </div>
    </div>
  </div>

  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        cursor-server<span class="brand-sub">ops</span>
        <button type="button" class="secondary nav-toggle" id="btn-nav-toggle" aria-expanded="false" aria-controls="sidebar">Menu</button>
      </div>
      <nav class="nav-links" aria-label="Main">
${renderNav(view.viewId)}      </nav>
      <div class="nav-footer">
        <button type="button" class="secondary" id="btn-logout">Log out</button>
      </div>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <h1>${view.title}</h1>
${view.actions ? `        <div class="topbar-actions">${view.actions}</div>\n` : ""}      </header>
      <main class="main-pane${view.fill ? " fill" : ""}" id="main-pane">
${view.body}
      </main>
    </div>
  </div>
${view.overlays ? `${view.overlays}\n` : ""}${scripts}
</body>
</html>`;
}
