// src/infrastructure/FrameContext.ts

/** Carries frame depth information through the request lifecycle. */
export interface FrameContext {
  /** The current frame depth (0 = top-level, 1+ = nested). */
  depth: number;
  /** The original request path (without _depth param). */
  path: string;
}

// Module-level state — safe in Cloudflare Workers (one request per isolate)
let _currentPath: string = "/";
let _currentDepth: number = 0;

/** Set the frame context for the current request. Called by frameMiddleware. */
export function setFrameContext(path: string, depth: number): void {
  _currentPath = path;
  _currentDepth = depth;
}

/** Get the current request path (without _depth). */
export function getFramePath(): string {
  return _currentPath;
}

/** Get the current frame depth. */
export function getFrameDepth(): number {
  return _currentDepth;
}