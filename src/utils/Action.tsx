/**
 * Action — server-side component factory for wiring up client-side handlers.
 *
 * Keeps handler names and method names in sync between the server
 * views (this file) and the client handlers (src/client/handlers/).
 *
 * Usage:
 *
 *   // Wrapper + Trigger — handler scoped to a container element
 *   const Dismiss = Action("dismiss");
 *
 *   <Dismiss class="card">
 *     <span>Content</span>
 *     <Dismiss.Trigger event="click" method="hide">
 *       <button>✕</button>
 *     </Dismiss.Trigger>
 *   </Dismiss>
 *
 *   // Trigger only — handler lives on the interactive element itself
 *   const Confirm = Action("confirm");
 *
 *   <Confirm.Trigger event="click" method="ask" message="Are you sure?">
 *     <a href="/">Proceed</a>
 *   </Confirm.Trigger>
 *
 * Data params passed to Trigger (like `message`) are automatically
 * converted to data-{handler}-{key} attributes on the child element.
 */

import { JSX } from "hono/jsx";

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
  vote: "submit";
  status: "transition";
  addoption: "add";
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
// Component factory
// ---------------------------------------------------------------------------

type TriggerProps<E extends keyof HandlerActions> = {
  /** DOM event to listen for */
  event: KnownDOMEvent | (string & {});
  /** Method name on the handler class */
  method: HandlerActions[E];
  children?: any;
} & Record<string, any>;

type WrapperProps = {
  /** HTML tag to render (default: "div") */
  tag?: string;
  children?: any;
} & Record<string, any>;

/**
 * Create a scoped Wrapper + Trigger pair for a client-side handler.
 *
 * Call once at the component level.
 *
 * Wrapper renders a container element with data-controller — use when
 * the handler must be scoped to a container (e.g. dismiss, where hide()
 * hides the container itself).
 *
 * Trigger renders its child element with data-controller, data-action,
 * and any extra props as data-{handler}-{key} attributes merged in.
 * Use Trigger alone when the interactive element is the right scope
 * for the handler (e.g. confirm).
 */
export function Action<E extends keyof HandlerActions>(name: E) {
  function Wrapper({ tag, children, ...rest }: WrapperProps) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    return (
      <Tag data-controller={name} {...rest}>
        {children}
      </Tag>
    );
  }

  function Trigger({ event, method, children, ...dataProps }: TriggerProps<E>) {
    // Attributes to inject into the child element
    const inject: Record<string, string> = {
      "data-controller": name,
      "data-action": `${event}->${name}#${method}`,
    };

    // Convert extra props to data-{handler}-{key}
    for (const key of Object.keys(dataProps)) {
      inject[`data-${name}-${key}`] = String(dataProps[key]);
    }

    // Single child element — re-render with all injected attributes merged in
    if (
      children != null &&
      typeof children === "object" &&
      "tag" in children &&
      !Array.isArray(children)
    ) {
      const Tag = (children as any).tag as keyof JSX.IntrinsicElements;
      const childProps = (children as any).props || {};
      const childChildren = (children as any).children;
      return (
        <Tag {...childProps} {...inject}>
          {childChildren}
        </Tag>
      );
    }

    // Fallback: wrap in a span
    return <span {...inject}>{children}</span>;
  }

  Wrapper.Trigger = Trigger;
  return Wrapper;
}
