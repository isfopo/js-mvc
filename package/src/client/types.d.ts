/**
 * Shared types for the client-side handler system.
 */

/** The action descriptor parsed from a data-action attribute */
export interface ActionDescriptor {
  /** DOM event name (click, submit, change, etc.) */
  event: string;
  /** Handler name (matches data-controller value) */
  handler: string;
  /** Method name on the handler instance */
  method: string;
}

/** A constructor for a Handler subclass */
export interface HandlerConstructor {
  new (element: HTMLElement): Handler;
  /** Each handler must declare which data-controller name it handles */
  readonly handlerName: string;
}

/** Names of lifecycle methods that can emit errors */
export type LifecycleName =
  | "beforeConnect"
  | "connect"
  | "afterConnect"
  | "beforeDisconnect"
  | "disconnect"
  | "appear"
  | "disappear";

/** Minimal handler interface used by the dispatcher */
export interface Handler {
  /** Called before the handler is wired up (setup, initial state) */
  beforeConnect?(): void;

  /** Called after the handler is instantiated and targets are resolved */
  connect(): void;

  /** Called after all wiring is complete (safe to interact with DOM) */
  afterConnect?(): void;

  /** Called before the handler is torn down */
  beforeDisconnect?(): void;

  /** Called when the element is removed from the DOM (cleanup) */
  disconnect(): void;

  /** Called when the element enters the viewport */
  appear?(): void;

  /** Called when the element leaves the viewport */
  disappear?(): void;

  /** Called when an error occurs in any lifecycle method */
  error?(error: Error, lifecycle: LifecycleName): void;
}
