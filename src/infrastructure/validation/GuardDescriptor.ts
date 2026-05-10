import type { Context } from "hono";
import type { IValidatable } from "./IValidatable";

/**
 * Describes a single guard associated with a controller method.
 * Stored in context.metadata by decorator factories and consumed
 * by ControllerBase.register() at route-wiring time.
 */

export interface ExistsGuard {
  type: "exists";
  handlerName: string;
  /** Context key to store the loaded entity under. */
  key: string;
  /** Async function that loads and returns the entity (or null if not found). */
  load: (c: Context) => Promise<unknown>;
}

export interface AuthorizeGuard {
  type: "authorize";
  handlerName: string;
  /** Async function that checks permission. Should throw on failure. */
  check: (c: Context) => Promise<void>;
}

export interface ValidateGuard {
  type: "validate";
  handlerName: string;
  /** Constructor that takes a parsed body Record and returns an IValidatable. */
  RequestClass: new (body: Record<string, unknown>) => IValidatable;
}

export type GuardDescriptor = ExistsGuard | AuthorizeGuard | ValidateGuard;
