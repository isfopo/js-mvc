/**
 * Abstract base class for client-side handlers.
 *
 * Mirrors the server-side ControllerBase pattern. Subclasses declare
 * a static `handlerName` and implement `connect()`.
 *
 * Usage in HTML:
 *   <div data-controller="confirm" data-confirm-message="Delete?">
 *     <button data-action="click->confirm#ask">Delete</button>
 *   </div>
 */

import type { Handler } from "../types";

export abstract class BaseHandler implements Handler {
  /** The root element that declared data-controller */
  readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  // --- Lifecycle ---

  /** Called automatically after the handler is wired up */
  abstract connect(): void;

  /** Called when the element is removed from the DOM (cleanup) */
  disconnect(): void {
    /* override in subclasses if needed */
  }

  // --- Helpers ---

  /**
   * Find a single target element within the handler's scope.
   * Targets are declared as data-{handler}-target="{name}" on child elements.
   *
   * Example: <input data-confirm-target="input" />  →  this.target("input")
   */
  target<T extends HTMLElement = HTMLElement>(name: string): T | null {
    const attr = `data-${this.handlerName}-target`;
    return this.element.querySelector<T>(`[${attr}="${name}"]`);
  }

  /**
   * Find all target elements within the handler's scope.
   */
  targets<T extends HTMLElement = HTMLElement>(name: string): NodeListOf<T> {
    const attr = `data-${this.handlerName}-target`;
    return this.element.querySelectorAll<T>(`[${attr}="${name}"]`);
  }

  /**
   * Read a configuration value from data-{handler}-{key} on the root element.
   *
   * Example: <div data-controller="confirm" data-confirm-message="Sure?">
   *          →  this.data("message")  // "Sure?"
   */
  data(key: string): string | null {
    return this.element.getAttribute(`data-${this.handlerName}-${key}`);
  }

  /** Convenience: shorthand for this.constructor.handlerName */
  private get handlerName(): string {
    return (this.constructor as typeof BaseHandler).handlerName;
  }

  /** Static handler name — override in subclasses */
  static readonly handlerName: string = "";
}
