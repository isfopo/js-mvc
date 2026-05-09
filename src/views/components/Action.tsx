/**
 * Action — server-side component factory for wiring up client-side handlers.
 *
 * Keeps handler names and method names in sync between the server
 * views (this file) and the client handlers (src/client/handlers/).
 *
 * Usage:
 *
 *   const Dismiss = Action("dismiss");
 *
 *   <Dismiss class="card">
 *     <span>Content</span>
 *     <Dismiss.Trigger event="click" method="hide">
 *       <button aria-label="Dismiss">✕</button>
 *     </Dismiss.Trigger>
 *   </Dismiss>
 *
 * Action(name) returns a component (the Wrapper) with a .Trigger
 * sub-component attached. Trigger injects data-action directly into
 * the child element — no wrapper or tag prop needed.
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
 * Call once at the component level. The returned Wrapper component
 * renders data-controller on its root element. Trigger injects
 * data-action into the first child element.
 *
 * @example
 *   const Confirm = Action("confirm");
 *
 *   <Confirm data-confirm-message="Are you sure?">
 *     <Confirm.Trigger event="click" method="ask">
 *       <a href="/">Proceed</a>
 *     </Confirm.Trigger>
 *   </Confirm>
 */
export function Action<E extends keyof HandlerActions>(name: E) {
  function Wrapper({ tag, children, ...rest }: WrapperProps) {
    const Tag = tag ?? "div";
    return (
      <Tag data-controller={name} {...rest}>
        {children}
      </Tag>
    );
  }

  function Trigger({ event, method, children, ...rest }: TriggerProps<E>) {
    const dataAction = `${event}->${name}#${method}`;

    // Single child element — re-render it with data-action merged in
    if (
      children != null &&
      typeof children === "object" &&
      "tag" in children &&
      !Array.isArray(children)
    ) {
      const Tag = children.tag;
      const childProps = (children as any).props || {};
      const childChildren = (children as any).children;
      return (
        <Tag {...childProps} data-action={dataAction} {...rest}>
          {childChildren}
        </Tag>
      );
    }

    // Fallback: wrap in a span with the action attribute
    return (
      <span data-action={dataAction} {...rest}>
        {children}
      </span>
    );
  }

  Wrapper.Trigger = Trigger;
  return Wrapper;
}
