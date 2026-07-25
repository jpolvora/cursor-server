import type { MiddlewareHandler } from "hono";
import type { Config } from "../config.js";

export function authMiddleware(config: Config): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = config.SERVER_API_KEY;

    if (!apiKey) {
      return next();
    }

    const authHeader = c.req.header("Authorization");
    const customHeader = c.req.header("X-API-Key");
    const queryKey = c.req.query("api_key") || c.req.query("token");

    let providedKey: string | undefined;

    if (customHeader) {
      providedKey = customHeader;
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7).trim();
    } else if (queryKey) {
      providedKey = queryKey;
    }

    if (providedKey && providedKey === apiKey) {
      return next();
    }

    return c.json({ error: "Unauthorized" }, 401);
  };
}
