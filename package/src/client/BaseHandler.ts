/**
 * Abstract base class for client-side handlers.
 *
 * Mirrors the server-side ControllerBase pattern. Subclasses declare
 * a static `handlerName` and implement `connect()`.
 *
 * Usage is via the Action component factory.
 * The handler name is bound once, and data params are passed as props:
 *
 *   const Confirm = Action("confirm");
 *   <Confirm.Trigger event="click" method="ask" message="Delete?">
 *     <button>Delete</button>
 *   </Confirm.Trigger>
 *
 * This renders: <button data-controller="confirm"
 *         data-action="click->confirm#ask"
 *         data-confirm-message="Delete?">Delete</button>
 */

import { register } from "./dispatcher";
import type { Handler, LifecycleName } from "./types";

/**
 * Decorator that registers a handler class with the dispatcher.
 * 
 * Usage:
 *   @Handler()
 *   export class DismissHandler extends BaseHandler { ... }
 *   // Registers as "dismiss" (class name minus "Handler" suffix, lowercased)
 * 
 *   @Handler("custom-name")
 *   export class MyHandler extends BaseHandler { ... }
 *   // Registers as "custom-name"
 */
export function Handler(name?: string) {
  return function <T extends new (element: HTMLElement) => BaseHandler>(
    target: T,
    context: ClassDecoratorContext<T>,
  ): T {
    let handlerName = name;
    if (!handlerName) {
      const className = String(context.name);
      // Strip "Handler" suffix if present, then lowercase
      handlerName = className.endsWith("Handler")
        ? className.slice(0, -7).toLowerCase()
        : className.toLowerCase();
    }
    register(handlerName, target);
    return target;
  };
}

export abstract class BaseHandler implements Handler {
  /** The root element that declared data-controller */
  readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  // --- Lifecycle ---

  /** Called before the handler is wired up (setup, initial state) */
  beforeConnect(): void {
    /* override in subclasses if needed */
  }

  /** Called automatically after the handler is wired up */
  abstract connect(): void;

  /** Called after all wiring is complete (safe to interact with DOM) */
  afterConnect(): void {
    /* override in subclasses if needed */
  }

  /** Called before the handler is torn down */
  beforeDisconnect(): void {
    /* override in subclasses if needed */
  }

  /** Called when the element is removed from the DOM (cleanup) */
  disconnect(): void {
    /* override in subclasses if needed */
  }

  /** Called when the element enters the viewport */
  appear(): void {
    /* override in subclasses if needed */
  }

  /** Called when the element leaves the viewport */
  disappear(): void {
    /* override in subclasses if needed */
  }

  /** Called when an error occurs in any lifecycle method */
  error(_error: Error, _lifecycle: LifecycleName): void {
    /* override in subclasses if needed — default logs to console */
  }

  // --- Helpers ---

  /**
   * Find a single target element within the handler's scope.
   * Targets are declared as data-{handler}-target="{name}" on child elements.
   *
   * Example: <input data-confirm-target="input" />  →  this.target("input")
   */
  target<T extends HTMLElement = HTMLElement>(name: string): T | null {
    const attr = `data-${this.name}-target`;
    return this.element.querySelector<T>(`[${attr}="${name}"]`);
  }

  /**
   * Find all target elements within the handler's scope.
   */
  targets<T extends HTMLElement = HTMLElement>(name: string): NodeListOf<T> {
    const attr = `data-${this.name}-target`;
    return this.element.querySelectorAll<T>(`[${attr}="${name}"]`);
  }

  /**
   * Read a configuration value from data-{handler}-{key} on the root element.
   *
   * Example: <div data-controller="confirm" data-confirm-message="Sure?">
   *          →  this.data("message")  // "Sure?"
   */
  data(key: string): string | null {
    return this.element.getAttribute(`data-${this.name}-${key}`);
  }

  /** Convenience: shorthand for this.constructor.name */
  get name(): string {
    return (this.constructor as typeof BaseHandler).name;
  }

  /** Static handler name — override in subclasses */
  static readonly name: string = "";
}
