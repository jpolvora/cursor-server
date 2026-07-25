import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { startScheduler } from "./jobs/scheduler.js";
import { AGENTS } from "./agents.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { createEventRoutes } from "./routes/events.js";
import { createJobsRoutes } from "./routes/jobs.js";
import { authMiddleware } from "./middleware/auth.js";
import { taskStore } from "./services/task-store.js";

const config = loadConfig();
const app = new Hono();

// Initialize Task Store persistence
taskStore.init(config.REPOS_ROOT);

if (!config.SERVER_API_KEY) {
  console.warn("⚠️ SERVER_API_KEY is not set. Authentication is disabled for task, event & jobs endpoints.");
}

app.route("/", healthRoutes);
app.get("/agents", (c) =>
  c.json({
    agents: [...AGENTS],
    default: "default",
    aliases: { generic: "default" },
  }),
);

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
