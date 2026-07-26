/** Shared prompt widget — standalone page and embeddable mount (see PROMPT_WIDGET_CLIENT_JS). */

export const PROMPT_WIDGET_STYLES = `
:root {
  --pw-bg: #0f1419;
  --pw-panel: #1a2332;
  --pw-border: #2d3a4d;
  --pw-text: #e7ecf3;
  --pw-muted: #8b9bb4;
  --pw-accent: #3d8bfd;
  --pw-ok: #3dd68c;
  --pw-bad: #f07178;
  --pw-warn: #ffcc66;
  --pw-mono: "Cascadia Code", "Fira Code", ui-monospace, monospace;
  --pw-sans: "Segoe UI", system-ui, sans-serif;
}
.cursor-prompt-widget, .cursor-prompt-page {
  font-family: var(--pw-sans);
  color: var(--pw-text);
}
.cursor-prompt-widget *, .cursor-prompt-page * { box-sizing: border-box; }
.cursor-prompt-widget label, .cursor-prompt-page label {
  display: block;
  font-size: 0.75rem;
  color: var(--pw-muted);
  margin-bottom: 0.25rem;
}
.cursor-prompt-widget input,
.cursor-prompt-widget select,
.cursor-prompt-widget textarea,
.cursor-prompt-widget button,
.cursor-prompt-page input,
.cursor-prompt-page select,
.cursor-prompt-page textarea,
.cursor-prompt-page button {
  font: inherit;
  color: var(--pw-text);
  background: var(--pw-panel);
  border: 1px solid var(--pw-border);
  border-radius: 6px;
  padding: 0.45rem 0.6rem;
}
.cursor-prompt-widget textarea, .cursor-prompt-page textarea {
  width: 100%;
  font-family: var(--pw-mono);
  font-size: 0.9rem;
  line-height: 1.45;
  min-height: 5rem;
  resize: vertical;
}
.cursor-prompt-widget button, .cursor-prompt-page button {
  cursor: pointer;
  background: var(--pw-accent);
  border-color: transparent;
  font-weight: 600;
}
.cursor-prompt-widget button.secondary,
.cursor-prompt-page button.secondary {
  background: var(--pw-panel);
  border-color: var(--pw-border);
}
.cursor-prompt-widget button:disabled,
.cursor-prompt-page button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pw-layout {
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
  gap: 1rem;
  align-items: start;
}
@media (max-width: 760px) {
  .pw-layout { grid-template-columns: 1fr; }
}
.pw-panel {
  background: rgba(26, 35, 50, 0.55);
  border: 1px solid var(--pw-border);
  border-radius: 8px;
  padding: 0.85rem;
}
.pw-prompt-box {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.pw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: end;
}
.pw-row > div { flex: 1; min-width: 120px; }
.pw-status {
  font-family: var(--pw-mono);
  font-size: 0.8rem;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  background: var(--pw-panel);
  border: 1px solid var(--pw-border);
}
.pw-status.ok { border-color: var(--pw-ok); color: var(--pw-ok); }
.pw-status.bad { border-color: var(--pw-bad); color: var(--pw-bad); }
.pw-status.running { border-color: var(--pw-warn); color: var(--pw-warn); }
.pw-output {
  font-family: var(--pw-mono);
  font-size: 0.8rem;
  line-height: 1.4;
  background: #0a0e14;
  border: 1px solid var(--pw-border);
  border-radius: 6px;
  padding: 0.65rem;
  min-height: 200px;
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.pw-task-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: 42vh;
  overflow: auto;
}
.pw-task-list li {
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  border: 1px solid transparent;
  margin-bottom: 0.25rem;
}
.pw-task-list li:hover { background: var(--pw-panel); }
.pw-task-list li.active { border-color: var(--pw-accent); background: var(--pw-panel); }
.pw-task-list .meta { color: var(--pw-muted); font-size: 0.72rem; }
.pw-hint { color: var(--pw-muted); font-size: 0.78rem; margin-top: 0.5rem; }
`;

export const PROMPT_WIDGET_CLIENT_JS = `
/**
 * cursor-server agent prompt widget
 *
 * Embed in any page served by cursor-server:
 *   <div data-cursor-prompt-widget data-default-repo="my-repo"></div>
 *   <script src="/ui/prompt-widget.js" defer></script>
 *
 * Programmatic mount:
 *   window.CursorPromptWidget.mount(element, { defaultRepo: "my-repo", compact: false });
 */
(function () {
  var KEY_STORAGE = "cursor-server-api-key";
  var REPO_STORAGE = "cursor-server-repo";
  var AGENT_STORAGE = "cursor-server-agent";

  function authHeaders(apiKey) {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
      headers["Authorization"] = "Bearer " + apiKey;
    }
    return headers;
  }

  function apiKeyFromInput(input) {
    return input ? input.value.trim() : (sessionStorage.getItem(KEY_STORAGE) || "");
  }

  async function api(path, options, apiKey) {
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

  function statusClass(status) {
    if (status === "completed") return "ok";
    if (status === "failed" || status === "cancelled") return "bad";
    if (status === "running" || status === "queued") return "running";
    return "";
  }

  function truncate(text, max) {
    if (!text) return "";
    return text.length <= max ? text : text.slice(0, max - 1) + "…";
  }

  function mount(container, options) {
    options = options || {};
    var compact = !!options.compact;
    container.classList.add("cursor-prompt-widget");
    container.innerHTML =
      '<div class="pw-layout">' +
        '<aside class="pw-panel">' +
          '<label>Recent tasks</label>' +
          '<button type="button" class="secondary pw-refresh-tasks" style="width:100%;margin-bottom:0.5rem">Refresh</button>' +
          '<ul class="pw-task-list"></ul>' +
          '<p class="pw-hint">Filtered by repo when set; otherwise global.</p>' +
        '</aside>' +
        '<section class="pw-prompt-box">' +
          '<div class="pw-row">' +
            '<div><label>Repository</label><input class="pw-repo" placeholder="repo-name" autocomplete="off" /></div>' +
            '<div><label>Agent role</label><select class="pw-agent"></select></div>' +
            '<div><label>API key (optional)</label><input class="pw-api-key" type="password" placeholder="SERVER_API_KEY" autocomplete="off" /></div>' +
          '</div>' +
          '<div><label>Prompt</label><textarea class="pw-prompt" rows="' + (compact ? "3" : "4") + '" placeholder="Ask the agent to do something in the selected repo…"></textarea></div>' +
          '<div class="pw-row">' +
            '<button type="button" class="pw-submit">Submit task</button>' +
            '<button type="button" class="secondary pw-clear-output">Clear output</button>' +
          '</div>' +
          '<div class="pw-status">Idle — enter a prompt and submit</div>' +
          '<div class="pw-output" aria-live="polite"></div>' +
        '</section>' +
      '</div>';

    var el = {
      repo: container.querySelector(".pw-repo"),
      agent: container.querySelector(".pw-agent"),
      apiKey: container.querySelector(".pw-api-key"),
      prompt: container.querySelector(".pw-prompt"),
      submit: container.querySelector(".pw-submit"),
      clear: container.querySelector(".pw-clear-output"),
      status: container.querySelector(".pw-status"),
      output: container.querySelector(".pw-output"),
      taskList: container.querySelector(".pw-task-list"),
      refreshTasks: container.querySelector(".pw-refresh-tasks"),
    };

    var activeTaskId = null;
    var eventSource = null;
    var outputBuffer = {};

    el.apiKey.value = sessionStorage.getItem(KEY_STORAGE) || "";
    el.repo.value = options.defaultRepo || sessionStorage.getItem(REPO_STORAGE) || container.getAttribute("data-default-repo") || "";

    el.apiKey.addEventListener("change", function () {
      sessionStorage.setItem(KEY_STORAGE, el.apiKey.value.trim());
    });
    el.repo.addEventListener("change", function () {
      sessionStorage.setItem(REPO_STORAGE, el.repo.value.trim());
      loadTasks();
    });

    function setStatus(text, kind) {
      el.status.textContent = text;
      el.status.className = "pw-status " + (kind || "");
    }

    function appendOutput(taskId, chunk) {
      if (!outputBuffer[taskId]) outputBuffer[taskId] = "";
      outputBuffer[taskId] += chunk;
      if (activeTaskId === taskId) {
        el.output.textContent = outputBuffer[taskId];
        el.output.scrollTop = el.output.scrollHeight;
      }
    }

    function showOutput(taskId) {
      el.output.textContent = outputBuffer[taskId] || "";
      el.output.scrollTop = el.output.scrollHeight;
    }

    function closeStream() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }

    function streamUrl(taskId) {
      var key = apiKeyFromInput(el.apiKey);
      var url = "/tasks/" + encodeURIComponent(taskId) + "/stream";
      if (key) url += "?apiKey=" + encodeURIComponent(key);
      return url;
    }

    function watchTask(taskId) {
      closeStream();
      activeTaskId = taskId;
      container.querySelectorAll(".pw-task-list li").forEach(function (li) {
        li.classList.toggle("active", li.getAttribute("data-id") === taskId);
      });
      showOutput(taskId);
      setStatus("Connecting to task " + taskId + "…", "running");

      eventSource = new EventSource(streamUrl(taskId));
      eventSource.addEventListener("status", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          setStatus("Task " + taskId + ": " + data.status, statusClass(data.status));
          if (data.error) appendOutput(taskId, "\\n[error] " + data.error + "\\n");
          if (data.result && data.result.text) appendOutput(taskId, "\\n" + data.result.text + "\\n");
        } catch (_) {}
      });
      eventSource.addEventListener("output", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          appendOutput(taskId, data.chunk || "");
        } catch (_) {}
      });
      eventSource.addEventListener("done", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          setStatus("Task " + taskId + ": " + data.status, statusClass(data.status));
        } catch (_) {}
        closeStream();
        loadTasks();
      });
      eventSource.onerror = function () {
        closeStream();
        loadTaskDetail(taskId);
      };
    }

    async function loadTaskDetail(taskId) {
      var key = apiKeyFromInput(el.apiKey);
      var result = await api("/tasks/" + encodeURIComponent(taskId), { headers: authHeaders(key) }, key);
      if (!result.res.ok || !result.body) {
        setStatus("Could not load task " + taskId, "bad");
        return;
      }
      var task = result.body;
      activeTaskId = taskId;
      container.querySelectorAll(".pw-task-list li").forEach(function (li) {
        li.classList.toggle("active", li.getAttribute("data-id") === taskId);
      });
      if (!outputBuffer[taskId]) {
        var lines = [];
        lines.push("[prompt] " + (task.prompt || ""));
        if (task.error) lines.push("[error] " + task.error);
        if (task.result && task.result.text) lines.push(task.result.text);
        outputBuffer[taskId] = lines.join("\\n\\n");
      }
      showOutput(taskId);
      setStatus("Task " + taskId + ": " + task.status, statusClass(task.status));
      if (task.status === "running" || task.status === "queued") {
        watchTask(taskId);
      }
    }

    async function loadAgents() {
      var result = await api("/agents", { headers: { Accept: "application/json" } }, "");
      var agents = (result.body && result.body.agents) || ["default"];
      var saved = sessionStorage.getItem(AGENT_STORAGE) || "default";
      el.agent.innerHTML = agents.map(function (a) {
        return '<option value="' + a + '">' + a + '</option>';
      }).join("");
      if (agents.indexOf(saved) >= 0) el.agent.value = saved;
      el.agent.addEventListener("change", function () {
        sessionStorage.setItem(AGENT_STORAGE, el.agent.value);
      });
    }

    async function loadTasks() {
      var key = apiKeyFromInput(el.apiKey);
      var repo = el.repo.value.trim();
      var qs = repo ? "?repo=" + encodeURIComponent(repo) : "";
      var result = await api("/tasks" + qs, { headers: authHeaders(key) }, key);
      if (!result.res.ok) {
        el.taskList.innerHTML = '<li class="meta">Could not load tasks</li>';
        return;
      }
      var tasks = (result.body && result.body.tasks) || [];
      tasks.sort(function (a, b) {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      tasks = tasks.slice(0, 30);
      el.taskList.innerHTML = tasks.map(function (t) {
        return '<li data-id="' + t.id + '">' +
          '<div>' + truncate(t.prompt, 48) + '</div>' +
          '<div class="meta">' + t.status + " · " + (t.repo || "") + '</div>' +
        '</li>';
      }).join("");
      el.taskList.querySelectorAll("li[data-id]").forEach(function (li) {
        li.addEventListener("click", function () {
          loadTaskDetail(li.getAttribute("data-id"));
        });
      });
    }

    async function submitTask() {
      var repo = el.repo.value.trim();
      var prompt = el.prompt.value.trim();
      var key = apiKeyFromInput(el.apiKey);
      if (!repo) {
        setStatus("Repository is required", "bad");
        return;
      }
      if (!prompt) {
        setStatus("Prompt is required", "bad");
        return;
      }
      sessionStorage.setItem(REPO_STORAGE, repo);
      sessionStorage.setItem(AGENT_STORAGE, el.agent.value);
      el.submit.disabled = true;
      setStatus("Submitting…", "running");

      var result = await api("/tasks", {
        method: "POST",
        headers: authHeaders(key),
        body: JSON.stringify({
          prompt: prompt,
          repo: repo,
          agent: el.agent.value,
          async: true,
          source: "api",
        }),
      }, key);

      el.submit.disabled = false;
      if (!result.res.ok) {
        var err = (result.body && (result.body.error || JSON.stringify(result.body))) || "Submit failed";
        setStatus(String(err), "bad");
        return;
      }

      var taskId = result.body.taskId || result.body.id;
      if (!taskId) {
        setStatus("Task created but no id returned", "bad");
        return;
      }

      outputBuffer[taskId] = "";
      el.prompt.value = "";
      setStatus("Task " + taskId + " queued", "running");
      watchTask(taskId);
      loadTasks();
    }

    el.submit.addEventListener("click", submitTask);
    el.clear.addEventListener("click", function () {
      if (activeTaskId) outputBuffer[activeTaskId] = "";
      el.output.textContent = "";
    });
    el.refreshTasks.addEventListener("click", loadTasks);
    el.prompt.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        submitTask();
      }
    });

    loadAgents().then(loadTasks);
  }

  window.CursorPromptWidget = { mount: mount };

  function autoMount() {
    document.querySelectorAll("[data-cursor-prompt-widget]").forEach(function (node) {
      if (node.getAttribute("data-pw-mounted") === "1") return;
      node.setAttribute("data-pw-mounted", "1");
      mount(node, {
        defaultRepo: node.getAttribute("data-default-repo") || undefined,
        compact: node.getAttribute("data-compact") === "true",
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})();
`;

export function renderPromptPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agent Prompt — cursor-server</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(160deg, #0f1419 0%, #15202b 55%, #0f1419 100%);
    }
    .cursor-prompt-page header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--pw-border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
    }
    .cursor-prompt-page header h1 { margin: 0; font-size: 1.15rem; font-weight: 600; }
    .cursor-prompt-page header .sub { color: var(--pw-muted); font-size: 0.85rem; }
    .cursor-prompt-page header a { color: var(--pw-accent); text-decoration: none; }
    .cursor-prompt-page main { padding: 1rem; max-width: 1100px; margin: 0 auto; }
    ${PROMPT_WIDGET_STYLES}
  </style>
</head>
<body class="cursor-prompt-page">
  <header>
    <div>
      <h1>Agent Prompt</h1>
      <div class="sub">cursor-server · prompt → task → stream ·
        <a href="/ui/board">board</a> · <a href="/ui/spec-editor">spec-editor</a>
      </div>
    </div>
  </header>
  <main>
  <!-- Embed elsewhere: <div data-cursor-prompt-widget></div> + script /ui/prompt-widget.js -->
    <div data-cursor-prompt-widget></div>
  </main>
  <script src="/ui/prompt-widget.js" defer></script>
</body>
</html>`;
}
