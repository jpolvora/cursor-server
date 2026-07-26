/** Kanban board view — lanes, drag-to-plan, and run control, rendered in the shared shell. */

import { renderShellPage } from "./shell.js";

export const BOARD_STYLES = `
.board-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--sp-3);
}
.board {
  display: flex;
  gap: var(--sp-2);
  align-items: stretch;
  height: 100%;
  min-height: 0;
}
.column {
  flex: 0 0 208px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}
.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--row-h);
  padding: 0 var(--sp-3);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm);
  font-weight: 500;
}
.column-header .count { color: var(--faint); font-family: var(--mono); font-size: var(--fs-xs); }
.column.execution .column-header { color: var(--muted); }
.column-body {
  flex: 1;
  min-height: 60px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-2);
}
.column-body.drop-target { outline: 1px dashed var(--accent); outline-offset: -2px; }
.column-body.drop-reject { outline: 1px dashed var(--bad); outline-offset: -2px; }

.card {
  position: relative;
  padding: var(--sp-2) var(--sp-3);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r);
  font-size: var(--fs-sm);
}
.card.draggable { cursor: grab; }
.card.dragging { opacity: 0.4; }
.card.locked { border-color: var(--warn); }
.card-title { font-weight: 500; line-height: 1.35; padding-right: var(--sp-5); margin-bottom: var(--sp-2); }
.badges { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
.card .badge.repo { color: var(--accent); }
.card .badge.workflow-full { color: var(--ok); }
.card .badge.workflow-lite { color: var(--warn); }
.card .badge.run { color: var(--warn); border-color: var(--warn); }
.card .badge.failed { color: var(--bad); border-color: var(--bad); }
.card .badge.paused-run { color: var(--warn); border-color: var(--warn); }
.step-chip { margin-top: var(--sp-1); font-family: var(--mono); font-size: var(--fs-xs); color: var(--faint); }

.card-menu-wrap { position: absolute; top: var(--sp-1); right: var(--sp-1); }
.card-menu-btn {
  height: 18px;
  padding: 0 var(--sp-2);
  background: transparent;
  border: none;
  color: var(--faint);
  font-size: var(--fs);
  line-height: 1;
}
.card-menu-btn:hover { color: var(--text); filter: none; }
.card-menu {
  display: none;
  position: absolute;
  top: 20px;
  right: 0;
  z-index: 20;
  min-width: 168px;
  padding: var(--sp-1);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
}
.card-menu.open { display: block; }
.card-menu button {
  display: block;
  width: 100%;
  height: var(--row-h);
  padding: 0 var(--sp-3);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--r);
  color: var(--text);
  font-weight: 400;
  font-size: var(--fs-sm);
}
.card-menu button:hover:not(:disabled) { background: var(--panel-hover); filter: none; }
.card-menu button:disabled { color: var(--faint); }
.card-menu .sep { height: 1px; margin: var(--sp-1) 0; background: var(--border); }

#status-bar {
  flex-shrink: 0;
  padding: var(--sp-1) var(--sp-5);
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-family: var(--mono);
  font-size: var(--fs-xs);
  color: var(--faint);
}

#toast {
  display: none;
  position: fixed;
  right: var(--sp-5);
  bottom: var(--sp-5);
  z-index: 250;
  max-width: 320px;
  padding: var(--sp-2) var(--sp-4);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  font-size: var(--fs-sm);
}
#toast.show { display: block; }
#toast.ok { border-color: var(--ok); color: var(--ok); }
#toast.bad { border-color: var(--bad); color: var(--bad); }

#start-modal fieldset {
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--r);
}
#start-modal legend { padding: 0 var(--sp-1); font-size: var(--fs-xs); color: var(--faint); }
#start-modal fieldset label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  margin: 0 var(--sp-4) 0 0;
  color: var(--text);
  font-size: var(--fs-sm);
}
#start-modal fieldset input { width: auto; height: auto; }
`;

const BOARD_ACTIONS = `<select id="repo-filter" aria-label="Repository filter"><option value="">All repos</option></select>
        <button type="button" class="secondary" id="btn-refresh">Refresh</button>`;

const BOARD_BODY = `        <div class="board-wrap">
          <div class="board" id="board"></div>
        </div>
        <div id="status-bar">Loading…</div>`;

const BOARD_OVERLAYS = `  <div id="toast" role="status"></div>
  <div id="start-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="start-modal-title">
    <div class="modal-panel">
      <h2 id="start-modal-title">Start card</h2>
      <p id="start-modal-card" class="sub"></p>
      <div class="field">
        <label for="start-workflow">Workflow</label>
        <select id="start-workflow">
          <option value="full">full — spec-to-pr</option>
          <option value="lite">lite — spec-to-pr-lite</option>
        </select>
      </div>
      <div class="field">
        <label for="start-model">Model (optional)</label>
        <input id="start-model" type="text" placeholder="host default" />
      </div>
      <fieldset>
        <legend>Flags</legend>
        <label><input type="checkbox" id="start-flag-auto" checked /> auto</label>
        <label><input type="checkbox" id="start-flag-dry" /> dry-run</label>
      </fieldset>
      <div class="modal-actions">
        <button type="button" class="secondary" id="start-cancel">Cancel</button>
        <button type="button" id="start-confirm">Start</button>
      </div>
    </div>
  </div>`;

export const BOARD_CLIENT_JS = `(function () {
  var auth = window.cursorServerAuth;
  var POLL_MS = 5000;
  var LANES = ["backlog","refine","ready","implementing","review","ship","done","paused","blocked"];
  var PLANNING_LANES = ["backlog","refine","ready"];
  var EXECUTION_LANES = ["implementing","review","ship","done","paused","blocked"];
  var LANE_LABELS = {
    backlog: "Backlog", refine: "Refine", ready: "Ready",
    implementing: "Implementing", review: "Review", ship: "Ship",
    done: "Done", paused: "Paused", blocked: "Blocked"
  };

  var el = {
    board: document.getElementById("board"),
    repoFilter: document.getElementById("repo-filter"),
    btnRefresh: document.getElementById("btn-refresh"),
    statusBar: document.getElementById("status-bar"),
    toast: document.getElementById("toast"),
    startModal: document.getElementById("start-modal"),
    startModalCard: document.getElementById("start-modal-card"),
    startWorkflow: document.getElementById("start-workflow"),
    startModel: document.getElementById("start-model"),
    startFlagAuto: document.getElementById("start-flag-auto"),
    startFlagDry: document.getElementById("start-flag-dry"),
    startCancel: document.getElementById("start-cancel"),
    startConfirm: document.getElementById("start-confirm"),
  };

  var repos = [];
  var cards = [];
  var pollTimer = null;
  var dragCardId = null;
  var pendingStartCardId = null;
  var toastTimer = null;

  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = "show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.className = ""; }, 4000);
  }

  async function api(path, options) {
    try {
      var res = await fetch(path, options);
      var text = await res.text();
      var body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      return { res: res, body: body };
    } catch (err) {
      var message = err && err.message ? err.message : "Network request failed";
      return { res: { ok: false, status: 0 }, body: { error: message } };
    }
  }

  function repoById(id) {
    return repos.find(function (r) { return r.id === id; });
  }

  function deriveSpecFilename(specMarkdown) {
    if (!specMarkdown) return null;
    var m = specMarkdown.match(/^---\\s*\\n([\\s\\S]*?)\\n---/);
    if (m) {
      var idMatch = m[1].match(/^slug:\\s*(.+)$/m) || m[1].match(/^id:\\s*(.+)$/m);
      if (idMatch) {
        var slug = idMatch[1].trim().replace(/^["']|["']$/g, "");
        if (slug) return slug + ".spec.md";
      }
    }
    return null;
  }

  function buildColumns() {
    el.board.innerHTML = "";
    LANES.forEach(function (lane) {
      var col = document.createElement("div");
      col.className = "column" + (EXECUTION_LANES.includes(lane) ? " execution" : "");
      col.dataset.lane = lane;

      var hdr = document.createElement("div");
      hdr.className = "column-header";
      var label = document.createElement("span");
      label.textContent = LANE_LABELS[lane];
      var count = document.createElement("span");
      count.className = "count";
      count.dataset.laneCount = lane;
      count.textContent = "0";
      hdr.appendChild(label);
      hdr.appendChild(count);

      var body = document.createElement("div");
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
    var counts = {};
    LANES.forEach(function (l) { counts[l] = 0; });

    cards.forEach(function (card) {
      var lane = card.lane || "backlog";
      if (!LANES.includes(lane)) return;
      counts[lane] = (counts[lane] || 0) + 1;
      var body = document.querySelector('.column-body[data-lane="' + lane + '"]');
      if (!body) return;
      body.appendChild(buildCardEl(card));
    });

    LANES.forEach(function (lane) {
      var c = document.querySelector('[data-lane-count="' + lane + '"]');
      if (c) c.textContent = String(counts[lane] || 0);
    });
  }

  function buildCardEl(card) {
    var repo = repoById(card.repo_id);
    var repoName = repo ? repo.name : "repo#" + card.repo_id;
    var locked = !!card.active_run_id;
    var canDrag = PLANNING_LANES.includes(card.lane) && !locked;

    var div = document.createElement("div");
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

    var menuWrap = document.createElement("div");
    menuWrap.className = "card-menu-wrap";
    var menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "card-menu-btn";
    menuBtn.textContent = "\\u22EE";
    menuBtn.title = "Card menu";
    menuBtn.setAttribute("aria-label", "Card menu");
    var menu = document.createElement("div");
    menu.className = "card-menu";

    function addMenuItem(label, fn, disabled, disabledTitle) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (disabled) {
        btn.disabled = true;
        if (disabledTitle) btn.title = disabledTitle;
      } else {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          menu.classList.remove("open");
          fn();
        });
      }
      menu.appendChild(btn);
    }

    function addSeparator() {
      var sep = document.createElement("div");
      sep.className = "sep";
      menu.appendChild(sep);
    }

    var hasRun = !!card.active_run_id;
    var isPaused = card.lane === "paused";
    var isBlocked = card.lane === "blocked";

    addMenuItem("Open in spec-editor", function () {
      var file = deriveSpecFilename(card.spec_markdown);
      var params = new URLSearchParams();
      params.set("repo", repoName);
      if (file) params.set("file", file);
      window.location.href = "/ui/spec-editor?" + params.toString();
    });
    addSeparator();
    addMenuItem("Start", function () { showStartDialog(card); }, hasRun, "Card already has an active run");
    addMenuItem("Resume", function () { resumeCardRun(card.id); }, !(hasRun && isPaused), "Resume is available when a run is paused");
    addMenuItem("Pause", function () { pauseCardRun(card.id); }, !(hasRun && !isPaused), "Pause is available while a run is active");
    addMenuItem("Finish", function () { finishCardRun(card); }, !hasRun, "Finish is available while a run is active");
    addSeparator();
    addMenuItem("Export spec", function () { exportCard(card.id); });
    addMenuItem("Delete", function () {
      if (confirm('Delete card "' + card.title + '"?')) deleteCard(card.id);
    });

    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".card-menu.open").forEach(function (m) { m.classList.remove("open"); });
      menu.classList.toggle("open");
    });

    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(menu);

    var title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.title;

    var badges = document.createElement("div");
    badges.className = "badges";
    var repoBadge = document.createElement("span");
    repoBadge.className = "badge repo";
    repoBadge.textContent = repoName;
    badges.appendChild(repoBadge);

    var wf = document.createElement("span");
    if (card.workflow) {
      wf.className = "badge workflow-" + (card.workflow === "lite" ? "lite" : "full");
      wf.textContent = card.workflow;
    } else {
      wf.className = "badge";
      wf.textContent = "unset";
    }
    badges.appendChild(wf);

    if (locked) {
      var run = document.createElement("span");
      if (isBlocked) {
        run.className = "badge failed";
        run.textContent = "failed";
      } else if (isPaused) {
        run.className = "badge paused-run";
        run.textContent = "paused";
      } else {
        run.className = "badge run";
        run.textContent = "run active";
      }
      badges.appendChild(run);
    }

    var step = document.createElement("div");
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
    var lane = e.currentTarget.dataset.lane;
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
    var lane = e.currentTarget.dataset.lane;
    e.currentTarget.classList.remove("drop-target", "drop-reject");
    var cardId = Number(e.dataTransfer.getData("text/plain") || dragCardId);
    if (!cardId) return;

    if (!PLANNING_LANES.includes(lane)) {
      toast("Cannot drop into " + LANE_LABELS[lane] + " — planning lanes only", "bad");
      return;
    }

    var card = cards.find(function (c) { return c.id === cardId; });
    if (!card) return;
    if (card.active_run_id) {
      toast("Card is run-locked", "bad");
      return;
    }
    if (card.lane === lane) return;

    var out = await api("/board/cards/" + cardId + "/move", {
      method: "POST",
      headers: auth.jsonHeaders(),
      body: JSON.stringify({ lane: lane }),
    });
    if (!out.res.ok) {
      toast("Move failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Moved to " + LANE_LABELS[lane], "ok");
    await refresh();
  }

  async function exportCard(cardId) {
    var out = await api("/board/cards/" + cardId + "/export-spec", {
      method: "POST",
      headers: auth.jsonHeaders(),
    });
    if (!out.res.ok) {
      toast("Export failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Exported " + (out.body.filename || "spec"), "ok");
  }

  async function deleteCard(cardId) {
    var out = await api("/board/cards/" + cardId, {
      method: "DELETE",
      headers: auth.headers(),
    });
    if (!out.res.ok) {
      toast("Delete failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Card deleted", "ok");
    await refresh();
  }

  function hideStartDialog() {
    pendingStartCardId = null;
    el.startModal.classList.add("hidden");
  }

  function showStartDialog(card) {
    pendingStartCardId = card.id;
    el.startModalCard.textContent = card.title;
    el.startWorkflow.value = card.workflow === "lite" ? "lite" : "full";
    el.startModel.value = "";
    el.startFlagAuto.checked = true;
    el.startFlagDry.checked = false;
    el.startModal.classList.remove("hidden");
  }

  async function startCardRun(cardId, payload) {
    var out = await api("/board/cards/" + cardId + "/start", {
      method: "POST",
      headers: auth.jsonHeaders(),
      body: JSON.stringify(payload),
    });
    if (!out.res.ok) {
      toast("Start failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return false;
    }
    var label = out.body && out.body.resumed ? "Run resumed" : "Run started";
    toast(label + " (" + (out.body.taskId || "task") + ")", "ok");
    await refresh();
    return true;
  }

  async function pauseCardRun(cardId) {
    var out = await api("/board/cards/" + cardId + "/pause", {
      method: "POST",
      headers: auth.jsonHeaders(),
    });
    if (!out.res.ok) {
      toast("Pause failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Run paused", "ok");
    await refresh();
  }

  async function resumeCardRun(cardId) {
    var out = await api("/board/cards/" + cardId + "/resume", {
      method: "POST",
      headers: auth.jsonHeaders(),
    });
    if (!out.res.ok) {
      toast("Resume failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Run resumed", "ok");
    await refresh();
  }

  async function finishCardRun(card) {
    if (!confirm('Finish and close "' + card.title + '"? This cancels any in-flight run.')) return;
    var out = await api("/board/cards/" + card.id + "/finish", {
      method: "POST",
      headers: auth.jsonHeaders(),
      body: JSON.stringify({ confirm: true }),
    });
    if (!out.res.ok) {
      toast("Finish failed: " + (out.body && out.body.error ? out.body.error : out.res.status), "bad");
      return;
    }
    toast("Card finished", "ok");
    await refresh();
  }

  async function loadRepos() {
    var out = await api("/board/repos", { headers: auth.headers() });
    if (!out.res.ok) {
      throw new Error(out.body && out.body.error ? out.body.error : "repos " + out.res.status);
    }
    repos = out.body.repos || [];
    var prev = el.repoFilter.value;
    el.repoFilter.innerHTML = '<option value="">All repos</option>';
    repos.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = r.name;
      el.repoFilter.appendChild(opt);
    });
    if (prev) el.repoFilter.value = prev;
  }

  async function loadCards() {
    var path = "/board/cards";
    var repoId = el.repoFilter.value;
    if (repoId) path += "?repoId=" + encodeURIComponent(repoId);
    var out = await api(path, { headers: auth.headers() });
    if (!out.res.ok) {
      throw new Error(out.body && out.body.error ? out.body.error : "cards " + out.res.status);
    }
    cards = out.body.cards || [];
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

  el.startCancel.addEventListener("click", hideStartDialog);
  el.startModal.addEventListener("click", function (e) {
    if (e.target === el.startModal) hideStartDialog();
  });
  el.startConfirm.addEventListener("click", async function () {
    if (!pendingStartCardId) return;
    var flags = [];
    if (el.startFlagAuto.checked) flags.push("auto");
    if (el.startFlagDry.checked) flags.push("dry-run");
    var payload = { workflow: el.startWorkflow.value, confirm: true, flags: flags };
    var model = el.startModel.value.trim();
    if (model) payload.model = model;
    var ok = await startCardRun(pendingStartCardId, payload);
    if (ok) hideStartDialog();
  });

  document.addEventListener("click", function () {
    document.querySelectorAll(".card-menu.open").forEach(function (m) { m.classList.remove("open"); });
  });

  el.repoFilter.addEventListener("change", refresh);
  el.btnRefresh.addEventListener("click", refresh);

  auth.ready(function () {
    buildColumns();
    refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, POLL_MS);
  });
})();
`;

export function renderBoardPageHtml(): string {
  return renderShellPage({
    viewId: "board",
    title: "Kanban Board",
    actions: BOARD_ACTIONS,
    styles: BOARD_STYLES,
    body: BOARD_BODY,
    overlays: BOARD_OVERLAYS,
    scripts: ["/ui/board-client.js"],
    fill: true,
  });
}
