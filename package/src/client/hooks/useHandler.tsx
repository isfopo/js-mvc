/**
 * useHandler — server-side component factory for wiring up client-side handlers.
 *
 * Keeps handler classes and their rendered HTML together. Each rendered
 * instance gets a generated id plus an inline script that hydrates the
 * handler onto that element — the handler "ships with" its HTML, and the
 * handler name never appears in the markup or in the component interface.
 *
 * Usage:
 *
 *   // Wrapper + Trigger — handler scoped to a container element
 *   const Dismiss = useHandler(DismissHandler);
 *
 *   <Dismiss class="card">
 *     <span>Content</span>
 *     <Dismiss.Trigger event="click" method="hide">
 *       <button>✕</button>
 *     </Dismiss.Trigger>
 *   </Dismiss>
 *
 *   // Trigger only — handler lives on the interactive element itself
 *   const Confirm = useHandler(ConfirmHandler);
 *
 *   <Confirm.Trigger event="click" method="ask" message="Are you sure?">
 *     <a href="/">Proceed</a>
 *   </Confirm.Trigger>
 *
 * Params passed to Wrapper or Trigger (like `message`) are automatically
 * converted to data-{key} attributes on the element, readable in the
 * handler via this.data("key"). Known HTML attributes (class, style,
 * data-*, aria-*, ...) pass through untouched.
 */

import { genId } from "utils/ids";
import { HandlerConstructor } from "../types";
import { JSX } from "react";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Module URL of the client bundle that exports hydrate() */
const CLIENT_MODULE_URL = import.meta.env.DEV
  ? "/src/client-entry.ts"
  : "/.generated/client/main.js";

/** Inline script that hydrates one handler instance onto its element */
function HydrateScript({ name, id }: { name: string; id: string }) {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{
        __html: `import { hydrate } from ${JSON.stringify(CLIENT_MODULE_URL)};hydrate(${JSON.stringify(name)},${JSON.stringify(id)});`,
      }}
    />
  );
}

/** HTML attributes passed through as-is; everything else becomes data-{key} */
const HTML_ATTRS = new Set(["class", "style", "role", "title", "hidden", "name"]);

/** Convert component props to element attributes */
function toAttrs(props: Record<string, any>): Record<string, any> {
  const attrs: Record<string, any> = {};
  for (const key of Object.keys(props)) {
    if (
      HTML_ATTRS.has(key) ||
      key.startsWith("data-") ||
      key.startsWith("aria-")
    ) {
      attrs[key] = props[key];
    } else {
      attrs[`data-${key}`] = String(props[key]);
    }
  }
  return attrs;
}

/**
 * Re-render a single JSX child element with extra attributes merged in.
 * Falls back to wrapping in a span when there is no single child.
 */
function renderChild(children: any, inject: Record<string, string>): any {
  if (
    children != null &&
    typeof children === "object" &&
    "props" in children &&
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
  return <span {...inject}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Component factory
// ---------------------------------------------------------------------------

type TriggerProps<HA extends Record<string, string>, E extends keyof HA> = {
  /** DOM event to listen for */
  event: keyof GlobalEventHandlersEventMap | (string & {});
  /** Method name on the handler class */
  method: HA[E];
  children?: any;
} & Record<string, any>;

type WrapperProps = {
  /** HTML tag to render (default: "div") */
  tag?: string;
  children?: any;
} & Record<string, any>;

/**
 * Create a scoped Wrapper + Trigger pair for a client-side handler class.
 *
 * Call at the component level:
 *
 *   const Confirm = useHandler(ConfirmHandler);
 *
 * Wrapper renders a container element and hydrates the handler on it —
 * use when the handler must be scoped to a container (e.g. dismiss,
 * where hide() hides the container itself).
 *
 * Trigger renders its child element with a data-action and any params as
 * data-{key} attributes. Used alone (no Wrapper), the interactive element
 * itself is hydrated (e.g. confirm). Used inside a Wrapper, it just
 * declares an action for the wrapper's handler instance.
 */
export function useHandler<
  H extends HandlerConstructor,
  HA extends Record<string, string> = Record<string, string>,
  E extends keyof HA & string = string
>(handler: H) {
  let uid: string | null;

  function Wrapper({ tag, children, ...dataProps }: WrapperProps) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    const attrs = toAttrs(dataProps);

    uid = genId();

    return (
      <>
        <Tag id={uid} {...attrs}>
          {children}
        </Tag>
        <HydrateScript name={handler.handlerName} id={uid} />
      </>
    );
  }

  function Trigger({
    event,
    method,
    children,
    ...dataProps
  }: TriggerProps<HA, E>) {
    const inject: Record<string, string> = {
      "data-action": `${event}->${method}`,
      ...toAttrs(dataProps),
    };

    if (!uid) {
      // Standalone Trigger — the element itself is hydrated
      uid = genId();
      return (
        <>
          {renderChild(children, { ...inject, id: uid })}
          <HydrateScript name={handler.handlerName} id={uid} />
        </>
      );
    } else {
      // Inside a Wrapper — belongs to the wrapper's handler instance
      return renderChild(children, inject);
    }
  }

  Wrapper.Trigger = Trigger;
  return Wrapper;
}
