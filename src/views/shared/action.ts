/**
 * Strongly typed helpers for building client-side handler attributes
 * in server-rendered JSX.
 *
 * Keeps handler names and method names in sync between the server
 * views (this file) and the client handlers (src/client/handlers/).
 *
 * Usage in JSX:
 *   data-controller={handler("dismiss")}
 *   data-action={action("click", "dismiss", "hide")}
 *
 * Both return plain strings — they just provide type checking and
 * autocomplete at build time. The rendered HTML is identical to
 * hand-written attribute strings.
 */

// ---------------------------------------------------------------------------
// Handler/method registry
// ---------------------------------------------------------------------------
// Add a new entry here when you create a new client handler.
// The key is the handler name (matches data-controller).
// The value is a union of method names on that handler.
// ---------------------------------------------------------------------------

export interface HandlerActions {
  dismiss: "hide";
  confirm: "ask";
}

// ---------------------------------------------------------------------------
// Known DOM event names (for autocomplete — any string still works)
// ---------------------------------------------------------------------------

export type KnownDOMEvent =
  | "click"
  | "submit"
  | "change"
  | "input"
  | "focus"
  | "blur"
  | "keydown"
  | "keyup"
  | "mouseenter"
  | "mouseleave"
  | "load"
  | "scroll"
  | "toggle";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a data-action attribute value.
 *
 * @example
 *   data-action={action("click", "dismiss", "hide")}
 *   // → 'click->dismiss#hide'
 *
 * TypeScript will autocomplete the handler name and then only
 * show valid methods for that handler.
 */
export function action<E extends keyof HandlerActions>(
  event: KnownDOMEvent | (string & {}),
  handler: E,
  method: HandlerActions[E],
): string {
  return `${event}->${handler}#${method}`;
}

/**
 * Build a data-controller attribute value.
 *
 * @example
 *   data-controller={handler("dismiss")}
 *   // → 'dismiss'
 *
 * Useful for consistency and so renames flow through the type system.
 */
export function handler<E extends keyof HandlerActions>(name: E): string {
  return name;
}

/**
 * Build a scoped config attribute: data-{handler}-{key}="value".
 *
 * @example
 *   data-confirm-message={handlerData("confirm", "message", "Are you sure?")}
 *   // → 'Are you sure?'  (already in data-confirm-message="…")
 */
export function handlerData<E extends keyof HandlerActions>(
  handler: E,
  key: string,
  value: string,
): string {
  return value;
}
