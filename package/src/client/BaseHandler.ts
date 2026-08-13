/**
 * Abstract base class for client-side handlers.
 *
 * Mirrors the server-side ControllerBase pattern. Subclasses implement
 * `connect()`; the handler name is derived from the class name at runtime
 * (e.g. `DismissHandler` → `"dismiss"`), so no decorator or static
 * declaration is needed.
 *
 * Usage is via the useHandler component factory:
 *
 *   const Confirm = useHandler(ConfirmHandler);
 *   <Confirm.Trigger event="click" method="ask" message="Delete?">
 *     <button>Delete</button>
 *   </Confirm.Trigger>
 *
 * This renders the button with a generated id, `data-action="click->ask"`,
 * a `data-message="Delete?"` param, and an inline script that hydrates
 * ConfirmHandler onto that button:
 *
 *   <button id="..." data-action="click->ask" data-message="Delete?">Delete</button>
 *   <script type="module">
 *     import { hydrate } from "...";
 *     hydrate("confirm", "...");
 *   </script>
 */

import type { Handler, LifecycleName } from "./types";

export abstract class BaseHandler implements Handler {
  /** The root element the handler is bound to */
  readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  // --- Name ---

  /**
   * The handler name, derived from the class name:
   * "DismissHandler" → "dismiss", "ConfirmHandler" → "confirm".
   * Used internally to key the client registry; it never appears in the
   * rendered HTML or in the component interface.
   */
  static get handlerName(): string {
    const raw = this.name; // the class's own Function.name
    return raw.endsWith("Handler")
      ? raw.slice(0, -7).toLowerCase()
      : raw.toLowerCase();
  }

  /** Alias of the handler name, for instance methods like data()/target() */
  get name(): string {
    return (this.constructor as typeof BaseHandler).handlerName;
  }

  // --- Lifecycle ---

  /** Called before the handler is wired up (setup, initial state) */
  beforeConnect(): void {}

  /** Called automatically after the handler is wired up */
  connect(): void {}

  /** Called after all wiring is complete (safe to interact with DOM) */
  afterConnect(): void {}

  /** Called before the handler is torn down */
  beforeDisconnect(): void {}

  /** Called when the element is removed from the DOM (cleanup) */
  disconnect(): void {}

  /** Called when the element enters the viewport */
  appear(): void {}

  /** Called when the element leaves the viewport */
  disappear(): void {}

  /** Called when an error occurs in any lifecycle method */
  error(_error: Error, _lifecycle: LifecycleName): void {}

  // --- Helpers ---

  /**
   * Find a single target element within the handler's scope.
   * Targets are declared as data-ref="{name}" on child elements.
   *
   * Example: <input data-ref="input" />  →  this.target("input")
   */
  target<T extends HTMLElement = HTMLElement>(name: string): T | null {
    return this.element.querySelector<T>(`[data-ref="${name}"]`);
  }

  /**
   * Find all target elements within the handler's scope.
   */
  targets<T extends HTMLElement = HTMLElement>(name: string): NodeListOf<T> {
    return this.element.querySelectorAll<T>(`[data-ref="${name}"]`);
  }

  /**
   * Read a configuration value from a data-{key} attribute on the root
   * element, falling back to the first matching attribute on a descendant.
   * Params passed to Wrapper/Trigger are converted to these attributes.
   *
   * Example: <div data-message="Sure?">  →  this.data("message")  // "Sure?"
   */
  data(key: string): string | null {
    const attr = `data-${key}`;
    const root = this.element.getAttribute(attr);
    if (root !== null) return root;
    return (
      this.element.querySelector<HTMLElement>(`[${attr}]`)?.getAttribute(attr) ??
      null
    );
  }
}
