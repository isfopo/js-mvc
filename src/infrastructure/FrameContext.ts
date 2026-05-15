// src/infrastructure/FrameContext.ts

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request frame context stored in AsyncLocalStorage.
 *
 * This provides safe per-request isolation under concurrent Cloudflare Workers
 * requests. When one request is suspended at an `await`, another request
 * can execute without overwriting the first request's depth/path values.
 *
 * Set by frameMiddleware via frameContextRun(). Read by getFrameDepth()
 * and getFramePath() from any downstream code (middleware, handlers, JSX).
 */
const frameALS = new AsyncLocalStorage<{ depth: number; path: string }>();

/**
 * Run a callback with the given frame context scoped to the current
 * async execution. Called by frameMiddleware to provide per-request
 * isolation.
 */
export function frameContextRun<T>(
  depth: number,
  path: string,
  fn: () => T,
): T {
  return frameALS.run({ depth, path }, fn);
}

/** Get the current request's frame depth (0 = top-level, 1+ = nested). */
export function getFrameDepth(): number {
  return frameALS.getStore()?.depth ?? 0;
}

/** Get the current request's path (without _depth query param). */
export function getFramePath(): string {
  return frameALS.getStore()?.path ?? "/";
}
