/** Root dashboard view — overview of the operator surfaces, rendered in the shared shell. */

import { renderShellPage } from "./shell.js";

const DASHBOARD_STYLES = `
.surface-list { margin-bottom: var(--sp-6); }
.surface-list .row-main strong { font-weight: 500; }
.surface-list .row-main span { display: block; color: var(--muted); font-size: var(--fs-sm); }
.endpoints { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.endpoints th {
  text-align: left;
  padding: var(--sp-2) var(--sp-3);
  color: var(--faint);
  font-weight: 500;
  font-size: var(--fs-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
}
.endpoints td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border);
  color: var(--muted);
}
.endpoints td:first-child { font-family: var(--mono); color: var(--text); white-space: nowrap; }
.endpoints tr:last-child td { border-bottom: none; }
`;

const DASHBOARD_BODY = `        <div class="view">
          <p class="view-intro">
            Local-first execution host. Pick a surface from the left menu — every view renders here in the
            main container.
          </p>

          <ul class="list surface-list">
            <li>
              <div class="row-main">
                <strong><a href="/ui/board">Kanban board</a></strong>
                <span>Plan cards and drive spec-to-pr runs: start, pause, resume, finish.</span>
              </div>
            </li>
            <li>
              <div class="row-main">
                <strong><a href="/ui/prompt">Agent prompt</a></strong>
                <span>Send a one-off prompt to a repo and stream the task output.</span>
              </div>
            </li>
            <li>
              <div class="row-main">
                <strong><a href="/ui/spec-editor">Spec editor</a></strong>
                <span>Author qualified specs, validate them, and trigger a harness run.</span>
              </div>
            </li>
            <li>
              <div class="row-main">
                <strong><a href="/ui/projects">Projects</a></strong>
                <span>Register the repositories the board and harness can execute against.</span>
              </div>
            </li>
            <li>
              <div class="row-main">
                <strong><a href="/ui/config">Configuration</a></strong>
                <span>Host preferences shared by every operator on this server.</span>
              </div>
            </li>
          </ul>

          <h2>Host endpoints</h2>
          <p class="view-intro">Reachable over the tailnet with the same API key used to sign in.</p>
          <table class="endpoints">
            <thead>
              <tr><th>Endpoint</th><th>Purpose</th></tr>
            </thead>
            <tbody>
              <tr><td>GET /health</td><td>Liveness probe</td></tr>
              <tr><td>GET /agents</td><td>Task agent roles</td></tr>
              <tr><td>POST /tasks</td><td>Run an agent task against a repo</td></tr>
              <tr><td>GET /jobs</td><td>Scheduler and review job history</td></tr>
              <tr><td>POST /harness/runs</td><td>Execute a qualified spec through the stage pipeline</td></tr>
            </tbody>
          </table>
        </div>`;

export function renderDashboardPageHtml(): string {
  return renderShellPage({
    viewId: "dashboard",
    title: "Dashboard",
    styles: DASHBOARD_STYLES,
    body: DASHBOARD_BODY,
  });
}
