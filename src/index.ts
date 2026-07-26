import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { startScheduler } from "./jobs/scheduler.js";
import { AGENTS } from "./agents.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { createEventRoutes } from "./routes/events.js";
import { createJobsRoutes } from "./routes/jobs.js";
import { createSpecRoutes, createRepoSpecRoutes } from "./routes/specs.js";
import { authMiddleware } from "./middleware/auth.js";
import { taskStore } from "./services/task-store.js";

import { createHarnessRoutes } from "./routes/harness.js";
import { createUiRoutes } from "./routes/ui.js";
import { stageStore } from "./services/stage-store.js";
import { boardDb } from "./services/board-db.js";
import { createBoardRoutes } from "./routes/board.js";

const config = loadConfig();
const app = new Hono();

// Initialize Stores persistence
taskStore.init(config.REPOS_ROOT);
stageStore.init(config.REPOS_ROOT);
await boardDb.init(config.BOARD_DB_PATH);

if (!config.SERVER_API_KEY) {
  if (config.TENANTS.length > 0) {
    console.warn("⚠️ SERVER_API_KEY is not set but TENANTS are configured. API key auth enforced via TENANTS.");
  } else {
    console.warn("⚠️ SERVER_API_KEY is not set and no TENANTS configured. Authentication is disabled — anonymous access allowed.");
  }
}

app.route("/", healthRoutes);
app.get("/agents", (c) =>
  c.json({
    agents: [...AGENTS],
    default: "default",
    aliases: { generic: "default" },
  }),
);

// Public UI (no auth) — APIs remain protected below
app.route("/ui", createUiRoutes());

// Protected routes
app.use("/tasks", authMiddleware(config));
app.use("/tasks/*", authMiddleware(config));
app.route("/tasks", createTaskRoutes(config));

app.use("/events", authMiddleware(config));
app.use("/events/*", authMiddleware(config));
app.route("/events", createEventRoutes(config));

app.use("/jobs", authMiddleware(config));
app.use("/jobs/*", authMiddleware(config));
app.route("/jobs", createJobsRoutes(config));

app.use("/specs", authMiddleware(config));
app.use("/specs/*", authMiddleware(config));
app.route("/specs", createSpecRoutes(config));

app.use("/repos", authMiddleware(config));
app.use("/repos/*", authMiddleware(config));
app.route("/repos", createRepoSpecRoutes(config));

app.use("/harness", authMiddleware(config));
app.use("/harness/*", authMiddleware(config));
app.route("/harness", createHarnessRoutes(config));

app.use("/board", authMiddleware(config));
app.use("/board/*", authMiddleware(config));
app.route("/board", createBoardRoutes(config));

startScheduler(config);

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
    hostname: config.HOST,
  },
  (info) => {
    console.log(`cursor-server listening on http://${info.address}:${info.port}`);
  },
);
