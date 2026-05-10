import type { Context } from "hono";
import type {
  GuardDescriptor,
  ExistsGuard,
  AuthorizeGuard,
  ValidateGuard,
} from "./GuardDescriptor";
import type { IValidatable } from "./IValidatable";

/**
 * Well-known symbol key used to store guard descriptors
 * inside the decorator metadata object.
 * Shared with ControllerBase via import.
 */
export const GUARDS_KEY = Symbol("hono:guards");

// ── Helper to append a guard to the shared metadata array ────────

function appendGuard(
  metadata: object,
  guard: GuardDescriptor,
): void {
  const arr: GuardDescriptor[] =
    ((metadata as any)[GUARDS_KEY] as GuardDescriptor[]) ??= [];
  arr.push(guard);
}

// ── Decorator factories ─────────────────────────────────────────

/**
 * Loads an entity and attaches it to the context.
 * Throws NotFoundError if the loader returns null or undefined.
 *
 * @param key  Context key to store the entity under (e.g. "tenet")
 * @param load Async function receiving the Context, returning the entity or null
 *
 * @example
 *   @Exists("tenet", (c) => tenetsRepo.findBySlug(c.env.DB, c.req.param("slug")))
 *   // → c.get("tenet") is available in the handler
 */
export function Exists(key: string, load: (c: Context) => Promise<unknown>) {
  return function <This>(
    _target: (this: This, ...args: any[]) => any,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    appendGuard(context.metadata, {
      type: "exists",
      key,
      load,
      handlerName: String(context.name),
    } satisfies ExistsGuard);
  };
}

/**
 * Checks authorization before the handler runs.
 * Should throw ForbiddenError (or any error) to reject.
 *
 * @param check Async function that inspects the Context and throws on failure
 *
 * @example
 *   @Authorize((c) => {
 *     const user = c.get("user");
 *     const tenet = c.get("tenet");
 *     if (tenet.proposed_by_id !== user.id) throw new ForbiddenError();
 *   })
 */
export function Authorize(check: (c: Context) => Promise<void> | void) {
  return function <This>(
    _target: (this: This, ...args: any[]) => any,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    appendGuard(context.metadata, {
      type: "authorize",
      check: async (c: Context) => { await check(c); },
      handlerName: String(context.name),
    } satisfies AuthorizeGuard);
  };
}

/**
 * Parses the request body (JSON or form-encoded), constructs a request
 * object implementing IValidatable, runs validate(), and attaches
 * the validated instance to `c.get("validated")`.
 *
 * Throws ValidationError on failure.
 *
 * @param RequestClass  Constructor taking `Record<string, unknown>` and implementing IValidatable
 *
 * @example
 *   @Validate(ProposeTenetRequest)
 *   // → c.get("validated") is a validated ProposeTenetRequest
 */
export function Validate(
  RequestClass: new (body: Record<string, unknown>) => IValidatable,
) {
  return function <This>(
    _target: (this: This, ...args: any[]) => any,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    appendGuard(context.metadata, {
      type: "validate",
      RequestClass,
      handlerName: String(context.name),
    } satisfies ValidateGuard);
  };
}
