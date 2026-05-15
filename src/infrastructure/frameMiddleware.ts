// src/infrastructure/frameMiddleware.ts

import type { Context, Next } from "hono";
import { frameContextRun } from "./FrameContext";

/**
 * Extract _depth from the query string and store it in the context.
 * Uses AsyncLocalStorage for per-request isolation so getFrameDepth()
 * and getFramePath() return correct values across async boundaries
 * and Hono sub-app mounts.
 *
 * - Depth 0: top-level page request (no _depth param)
 * - Depth 1+: nested iframe request
 */
export async function frameMiddleware(c: Context, next: Next): Promise<void> {
  const depthParam = c.req.query("_depth");
  const parsed = depthParam ? parseInt(depthParam, 10) : 0;
  // Guard against NaN from malformed _depth values and clamp to 0-10
  const depth = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, 10));
  const path = c.req.path; // path without query string

  // Store in Hono context for middleware/handler access
  c.set("frameDepth", depth);
  c.set("framePath", path);

  // Wrap the entire downstream chain in ALS so getFrameDepth()/getFramePath()
  // return the correct per-request values across async boundaries and
  // Hono sub-app mounts (app.route()).
  await frameContextRun(depth, path, async () => {
    await next();
  });
}
