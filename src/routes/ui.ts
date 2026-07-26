import { Hono } from "hono";
import { APP_CSS, APP_JS } from "./shell.js";
import { BOARD_CLIENT_JS, renderBoardPageHtml } from "./board-page.js";
import { CONFIG_CLIENT_JS, renderConfigPageHtml } from "./config-page.js";
import { PROJECTS_CLIENT_JS, renderProjectsPageHtml } from "./projects-page.js";
import {
  PROMPT_WIDGET_CLIENT_JS,
  renderPromptPageHtml,
} from "./prompt-widget.js";
import {
  SPEC_EDITOR_CLIENT_JS,
  renderSpecEditorPageHtml,
} from "./spec-editor-page.js";

const ASSET_HEADERS = { "Cache-Control": "public, max-age=300" } as const;

const SCRIPT_HEADERS = {
  "Content-Type": "application/javascript; charset=utf-8",
  ...ASSET_HEADERS,
};

/**
 * Public UI routes (no auth). Browser calls protected APIs with the API key
 * collected once by the shell login gate.
 */
export function createUiRoutes() {
  const ui = new Hono();

  ui.get("/app.css", (c) =>
    c.body(APP_CSS, 200, {
      "Content-Type": "text/css; charset=utf-8",
      ...ASSET_HEADERS,
    }),
  );

  ui.get("/app.js", (c) => c.body(APP_JS, 200, SCRIPT_HEADERS));

  ui.get("/board", (c) => c.html(renderBoardPageHtml()));
  ui.get("/board-client.js", (c) => c.body(BOARD_CLIENT_JS, 200, SCRIPT_HEADERS));

  ui.get("/projects", (c) => c.html(renderProjectsPageHtml()));
  ui.get("/projects-client.js", (c) => c.body(PROJECTS_CLIENT_JS, 200, SCRIPT_HEADERS));

  ui.get("/config", (c) => c.html(renderConfigPageHtml()));
  ui.get("/config-client.js", (c) => c.body(CONFIG_CLIENT_JS, 200, SCRIPT_HEADERS));

  ui.get("/spec-editor", (c) => c.html(renderSpecEditorPageHtml()));
  ui.get("/spec-editor-client.js", (c) => c.body(SPEC_EDITOR_CLIENT_JS, 200, SCRIPT_HEADERS));

  ui.get("/prompt", (c) => c.html(renderPromptPageHtml()));
  ui.get("/prompt-widget.js", (c) => c.body(PROMPT_WIDGET_CLIENT_JS, 200, SCRIPT_HEADERS));

  return ui;
}
