import type { MiddlewareHandler } from "hono";
import type { Config } from "../config.js";

declare module "hono" {
  interface ContextVariableMap {
    tenantId: string;
    allowedRepos: string[];
  }
}

export const TENANT_HEADER = "X-Tenant-Id";

export function resolveTenant(config: Config, authHeader?: string, customHeader?: string): { tenant: { tenantId: string; allowedRepos: string[] } | null; error?: string } {
  const masterKey = config.SERVER_API_KEY;
  const tenants = config.TENANTS;

  let providedKey: string | undefined;

  if (customHeader) {
    providedKey = customHeader;
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey) {
    return { tenant: null, error: "Missing authentication credentials" };
  }

  if (masterKey && providedKey === masterKey) {
    return { tenant: { tenantId: "master", allowedRepos: [] } };
  }

  for (const t of tenants) {
    if (providedKey === t.apiKey) {
      return { tenant: { tenantId: t.id, allowedRepos: t.allowedRepos } };
    }
  }

  return { tenant: null, error: "Invalid API key" };
}

export function authMiddleware(config: Config): MiddlewareHandler {
  return async (c, next) => {
    const { tenant, error } = resolveTenant(
      config,
      c.req.header("Authorization"),
      c.req.header("X-API-Key"),
    );

    if (!tenant) {
      return c.json({ error: error || "Unauthorized" }, 401);
    }

    c.set("tenantId", tenant.tenantId);
    c.set("allowedRepos", tenant.allowedRepos);

    return next();
  };
}
