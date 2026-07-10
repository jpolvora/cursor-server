import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { startScheduler } from "./jobs/scheduler.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRoutes } from "./routes/tasks.js";

const config = loadConfig();
const app = new Hono();

app.route("/", healthRoutes);
app.route("/tasks", createTaskRoutes(config));

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
