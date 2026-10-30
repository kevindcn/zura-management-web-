import { describe, it, expect } from "vitest";
import { app } from "../src/app.js";

interface RouteInfo {
  method: string;
  fullPath: string;
  middlewareNames: string[];
}

function extractAllRoutes(expressApp: any): RouteInfo[] {
  const routes: RouteInfo[] = [];

  function cleanRegexPath(regexp: any): string {
    if (!regexp) return "";
    const str = regexp.toString();
    // Express regex converts paths like /api/projects to /^\/api\/projects\/?(?=\/|$)/i
    const match = str
      .replace("/^\\", "")
      .replace("/?(?=\\/|$)/i", "")
      .replace(/\\\//g, "/")
      .replace(/\^\//g, "/")
      .replace(/\/\?\(\?=\\\/\|\$\)\/i/g, "")
      .replace(/\/\?\$'/g, "");
    
    // Clean up typical Express router path regex patterns
    const cleaned = match
      .replace(/^\^/, "")
      .replace(/\\\//g, "/")
      .split("?(?=")[0]
      .split("(?=")[0]
      .replace(/\/\?$/, "")
      .replace(/\/i$/, "")
      .replace(/\$$/, "");

    return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  }

  function traverseStack(stack: any[], basePath: string = "") {
    for (const layer of stack) {
      if (layer.route) {
        // Direct route on router/app
        const rawRoutePath = typeof layer.route.path === "string" ? layer.route.path : "";
        const combined = basePath + (rawRoutePath === "/" ? "" : rawRoutePath);
        const path = combined.replace(/\\/g, "").replace(/\/+/g, "/");
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const middlewareNames = layer.route.stack.map((s: any) => s.handle?.name || s.name || "");
        const hasPermissionMiddleware = layer.route.stack.some(
          (s: any) =>
            s.handle?.name === "permissionMiddleware" ||
            Boolean(s.handle?.permission) ||
            Boolean(s.permission)
        );

        for (const method of methods) {
          routes.push({
            method,
            fullPath: path,
            middlewareNames,
            hasPermission: hasPermissionMiddleware,
          } as any);
        }
      } else if (layer.name === "router" && layer.handle?.stack) {
        // Sub-router mounted with app.use(prefix, router)
        let prefix = cleanRegexPath(layer.regexp);
        if (prefix === "/^" || prefix === "/" || prefix === "/?") {
          prefix = "";
        }
        const combinedPath = `${basePath}${prefix}`.replace(/\/+/g, "/");
        traverseStack(layer.handle.stack, combinedPath);
      }
    }
  }

  if (expressApp._router?.stack) {
    traverseStack(expressApp._router.stack, "");
  }

  return routes;
}

describe("Route Security & Permission Declaration Guard (Temuan 4.1 Poin 3)", () => {
  const routes = extractAllRoutes(app);

  const PUBLIC_WHITELIST = [
    "GET /api/health",
    "POST /api/auth/register",
    "POST /api/auth/login",
    "POST /api/auth/demo-login",
  ];

  it("finds all registered endpoints in Express application", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it("verifies all registered routes are protected by default (deny-by-default)", () => {
    const unauthenticatedRoutes: string[] = [];

    for (const route of routes) {
      const endpointKey = `${route.method} ${route.fullPath}`;

      if (PUBLIC_WHITELIST.includes(endpointKey)) {
        continue; // Permitted public route
      }

      // Check if route includes authentication middleware
      const hasAuth = route.middlewareNames.some((name) =>
        ["authenticateToken", "authMiddleware"].includes(name)
      );

      if (!hasAuth) {
        unauthenticatedRoutes.push(endpointKey);
      }
    }

    // Must be completely empty - no unprotected endpoints outside whitelist!
    expect(unauthenticatedRoutes).toEqual([]);
  });

  it("verifies all project, issue, and comment mutation routes declare requirePermission", () => {
    const unpermissionedMutations: string[] = [];

    // Routes that mutate or access specific project resources must enforce permissions
    const protectedResourcePrefixes = [
      "/api/projects/:key",
      "/api/issues",
      "/api/comments",
    ];

    for (const route of routes) {
      const isResourceRoute = protectedResourcePrefixes.some((prefix) =>
        route.fullPath.startsWith(prefix)
      );

      if (!isResourceRoute) continue;

      if (!(route as any).hasPermission) {
        unpermissionedMutations.push(`${route.method} ${route.fullPath}`);
      }
    }

    expect(unpermissionedMutations).toEqual([]);
  });
});
