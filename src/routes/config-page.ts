/** Configuration view — host preference store (app_settings), rendered in the shared shell. */

import { renderShellPage } from "./shell.js";

const CONFIG_STYLES = `
.cfg-form { max-width: 340px; }
.cfg-form .field label { font-family: var(--mono); color: var(--muted); }
`;

const CONFIG_BODY = `        <div class="view">
          <p class="view-intro">
            Host-level preferences stored in SQLite. Values apply to every operator on this server.
          </p>
          <form class="cfg-form" id="cfg-form">
            <div class="field">
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
            <div class="field">
              <label for="cfg-default_harness_runner">default_harness_runner</label>
              <select id="cfg-default_harness_runner" name="default_harness_runner">
                <option value="cursor-local">cursor-local</option>
                <option value="cursor-sdk">cursor-sdk</option>
                <option value="hermes">hermes</option>
                <option value="opencode">opencode</option>
              </select>
            </div>
            <div class="field">
              <label for="cfg-ui_theme">ui_theme</label>
              <select id="cfg-ui_theme" name="ui_theme">
                <option value="dark">dark</option>
                <option value="light">light</option>
              </select>
            </div>
            <div class="field">
              <label for="cfg-ui_density">ui_density</label>
              <select id="cfg-ui_density" name="ui_density">
                <option value="comfortable">comfortable</option>
                <option value="compact">compact</option>
              </select>
            </div>
            <div class="field">
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
            <div class="actions">
              <button type="submit" id="btn-cfg-save">Save</button>
              <span id="cfg-status" class="status"></span>
            </div>
          </form>
        </div>`;

export const CONFIG_CLIENT_JS = `(function () {
  var auth = window.cursorServerAuth;
  var KEYS = [
    "default_agent",
    "default_harness_runner",
    "ui_theme",
    "ui_density",
    "board_default_lane",
  ];

  var form = document.getElementById("cfg-form");
  var status = document.getElementById("cfg-status");

  function applyPreferences(settings) {
    var root = document.documentElement;
    root.setAttribute("data-theme", settings.ui_theme || "dark");
    root.setAttribute("data-density", settings.ui_density || "comfortable");
  }

  function fillForm(settings) {
    KEYS.forEach(function (key) {
      var input = document.getElementById("cfg-" + key);
      if (input && settings[key] != null) input.value = settings[key];
    });
  }

  function readForm() {
    var settings = {};
    KEYS.forEach(function (key) {
      settings[key] = document.getElementById("cfg-" + key).value;
    });
    return settings;
  }

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = "status" + (kind ? " " + kind : "");
  }

  async function loadSettings() {
    try {
      var res = await fetch("/settings", { headers: auth.headers() });
      if (res.status !== 200) return;
      var body = await res.json();
      fillForm(body.settings || {});
      applyPreferences(body.settings || {});
    } catch (_) { /* leave defaults */ }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("Saving…");
    var settings = readForm();
    try {
      var res = await fetch("/settings", {
        method: "PUT",
        headers: auth.jsonHeaders(),
        body: JSON.stringify({ settings: settings }),
      });
      if (res.status !== 200) {
        setStatus("Save failed", "bad");
        return;
      }
      var body = await res.json();
      var saved = body.settings || settings;
      fillForm(saved);
      applyPreferences(saved);
      setStatus("Saved", "ok");
    } catch (_) {
      setStatus("Save failed", "bad");
    }
  });

  auth.ready(loadSettings);
})();
`;

export function renderConfigPageHtml(): string {
  return renderShellPage({
    viewId: "config",
    title: "Configuration",
    styles: CONFIG_STYLES,
    body: CONFIG_BODY,
    scripts: ["/ui/config-client.js"],
  });
}
