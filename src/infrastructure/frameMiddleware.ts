// src/infrastructure/frameMiddleware.ts

import type { Context, Next } from "hono";
import { setFrameContext } from "./FrameContext";

/**
 * Extract _depth from the query string and store it in the context.
 * Also sets module-level frame context so JSX components can read it.
 *
 * - Depth 0: top-level page request (no _depth param)
 * - Depth 1+: nested iframe request
 */
export async function frameMiddleware(c: Context, next: Next): Promise<void> {
  const depthParam = c.req.query("_depth");
  const depth = depthParam ? parseInt(depthParam, 10) : 0;
  const path = c.req.path; // path without query string

  // Store in Hono context for middleware/handler access
  c.set("frameDepth", depth);
  c.set("framePath", path);

  // Store in module-level context for JSX component access
  setFrameContext(path, depth);

  await next();
}