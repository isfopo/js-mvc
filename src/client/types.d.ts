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

/** Minimal handler interface used by the dispatcher */
export interface Handler {
  /** Called after the handler is instantiated and targets are resolved */
  connect(): void;
  /** Called when the element is removed from the DOM */
  disconnect(): void;
}
