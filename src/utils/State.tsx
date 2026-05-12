/**
 * State — server-side component factory for CSS-only state-driven interactivity.
 *
 * Declare state relationships (show/hide/disable based on form validity,
 * radio selection, focus, etc.) in JSX. Data attributes and CSS rules
 * using :has(), :valid, :focus-within, and :checked are generated
 * automatically — no selectors to write.
 *
 * Usage:
 *
 *   const Plan = State("plan");
 *
 *   <Plan.Wrapper>
 *     <Plan.Trigger value="free">
 *       <input type="radio" name="plan" value="free" />
 *     </Plan.Trigger>
 *     <Plan.Trigger value="pro">
 *       <input type="radio" name="plan" value="pro" />
 *     </Plan.Trigger>
 *
 *     <Plan.Show when="free" animate="fade">Free tier</Plan.Show>
 *     <Plan.Show when="pro">Pro tier</Plan.Show>
 *   </Plan.Wrapper>
 *
 * Each Wrapper instance auto-generates a unique scope ID (e.g. "plan-a7x3")
 * and emits a <style> block with scoped CSS rules. Provide a `scope` prop
 * to use a fixed name instead:
 *
 *   <Plan.Wrapper scope="pricing-form">...</Plan.Wrapper>
 *
 * Animation presets (fade, slide-up, slide-down, scale, slide-left, slide-right)
 * switch the hidden strategy from display:none to opacity/visibility/transform
 * so CSS transitions can animate between states. A custom `transition` prop
 * overrides the preset's timing.
 */

import { JSX } from "hono/jsx";

// ---------------------------------------------------------------------------
// Conditions registry
// ---------------------------------------------------------------------------
// Add entries here for autocomplete on the `when` prop.
// Built-in conditions ("valid", "invalid", "checked", "unchecked", "focused")
// are always available regardless of registry entries.
// ---------------------------------------------------------------------------

export interface StateConditions {
  form: "valid" | "invalid" | "focused";
  confirm: "checked" | "unchecked";
  plan: "free" | "pro" | "checked" | "unchecked";
  color: "red" | "blue" | "checked" | "unchecked";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuiltInCondition = "valid" | "invalid" | "checked" | "unchecked" | "focused";
type AnimationPresetName = "fade" | "fade-in" | "slide-up" | "slide-down" | "scale" | "slide-left" | "slide-right";

/**
 * Resolve the `when` prop type for a given state name.
 * If the name is registered in StateConditions, the value is restricted
 * to the union of built-in conditions + that entry's values.
 * Otherwise it falls back to string.
 */
type StateCondition<E extends string> =
  | BuiltInCondition
  | (E extends keyof StateConditions ? StateConditions[E] : string);

// ---------------------------------------------------------------------------
// Tag → display value mapping
// ---------------------------------------------------------------------------

const TAG_DISPLAY: Record<string, string> = {
  div: "block",
  span: "inline",
  p: "block",
  a: "inline",
  nav: "block",
  section: "block",
  article: "block",
  aside: "block",
  header: "block",
  footer: "block",
  main: "block",
  ul: "block",
  ol: "block",
  li: "list-item",
  table: "table",
  tr: "table-row",
  td: "table-cell",
  th: "table-cell",
  form: "block",
  button: "inline-block",
  label: "inline",
  fieldset: "block",
  h1: "block",
  h2: "block",
  h3: "block",
  h4: "block",
  h5: "block",
  h6: "block",
};

// ---------------------------------------------------------------------------
// Animation presets
// ---------------------------------------------------------------------------

interface AnimationPreset {
  /** CSS property values for the hidden (default) state */
  hidden: Record<string, string>;
  /** Default CSS transition string */
  transition: string;
}

const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  "fade": {
    hidden: { opacity: "0", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms",
  },
  "fade-in": {
    hidden: { opacity: "0", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms",
  },
  "slide-up": {
    hidden: { opacity: "0", transform: "translateY(8px)", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms, transform 200ms",
  },
  "slide-down": {
    hidden: { opacity: "0", transform: "translateY(-8px)", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms, transform 200ms",
  },
  "scale": {
    hidden: { opacity: "0", transform: "scale(0.95)", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms, transform 200ms",
  },
  "slide-left": {
    hidden: { opacity: "0", transform: "translateX(8px)", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms, transform 200ms",
  },
  "slide-right": {
    hidden: { opacity: "0", transform: "translateX(-8px)", pointerEvents: "none", visibility: "hidden" },
    transition: "opacity 200ms, transform 200ms",
  },
};

// ---------------------------------------------------------------------------
// SSR rendering helpers
// ---------------------------------------------------------------------------
// In Hono JSX SSR, function components are called during VNode construction
// (h()/jsx(), bottom-up: children before parents), not during
// renderToString traversal. This means the scope ID must be determined
// BEFORE rendering — at State() call time — so that both the Wrapper and
// effect components (Show, Hide, etc.) share the same scope ID from the
// closure.
//
// A module-level counter is used to auto-generate unique scope IDs per
// State() call. The count resets between requests (fresh Worker instance)
// or persists across them (same Worker) — either is fine since IDs only
// need to be unique within a page.
// ---------------------------------------------------------------------------

let scopeIdCounter = 0;

/** Clear internal counters (exposed for testing / manual cleanup). */
export function _clearStateBuffer(): void {
  scopeIdCounter = 0;
}

function generateScopeId(name: string): string {
  return `${name}-${++scopeIdCounter}`;
}

// ---------------------------------------------------------------------------
// CSS selector builder
// ---------------------------------------------------------------------------

/**
 * Build the CSS selector for a condition, relative to a scope selector.
 *
 * @param condition - Condition name ("valid", "checked", or a value string)
 * @param scopeSelector - e.g. `[data-state-scope="plan-a7x3"]`
 */
function buildConditionSelector(condition: string, scopeSelector: string): string {
  switch (condition) {
    case "valid":
      return `${scopeSelector}:valid`;
    case "invalid":
      return `${scopeSelector}:invalid`;
    case "checked":
      return `${scopeSelector}:has(:checked)`;
    case "unchecked":
      return `${scopeSelector}:not(:has(:checked))`;
    case "focused":
      return `${scopeSelector}:focus-within`;
    default:
      // Value-based condition: a radio/checkbox whose data-state-value matches
      return `${scopeSelector}:has([data-state-value="${condition}"]:checked)`;
  }
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/**
 * Convert a camelCase JS property name to a CSS property name.
 * e.g. "pointerEvents" → "pointer-events"
 */
function toCSSProp(jsx: string): string {
  return jsx.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Build a CSS declaration block from a key-value map. */
function cssBlock(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([k, v]) => `${toCSSProp(k)}: ${v}`)
    .join("; ");
}

/**
 * Generate CSS for a single effect.
 */
function generateEffectCSS(
  type: "show" | "hide" | "disable" | "enable",
  when: string,
  tag: string,
  scopeId: string,
  animate?: AnimationPresetName,
  transition?: string,
): string {
  const scopeSelector = `[data-state-scope="${scopeId}"]`;
  const isAnimated = !!(animate ?? transition);
  const displayValue = TAG_DISPLAY[tag] ?? "block";
  const preset = animate ? ANIMATION_PRESETS[animate] : null;
  const transitionString = transition ?? preset?.transition ?? null;
  const condSelector = buildConditionSelector(when, scopeSelector);
  const targetAttr = `data-state-${type}`;

  switch (type) {
    // ── Show ────────────────────────────────────
    case "show": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(
          `${scopeSelector} [${targetAttr}="${when}"] { ${cssBlock(preset.hidden)}; transition: ${transitionString}; }`,
        );
      }
      if (isAnimated) {
        lines.push(
          `${condSelector} [${targetAttr}="${when}"] { opacity: 1; pointer-events: auto; visibility: visible; }`,
        );
      } else {
        lines.push(
          `${condSelector} [${targetAttr}="${when}"] { display: ${displayValue}; }`,
        );
      }
      return lines.join("\n");
    }

    // ── Hide ────────────────────────────────────
    case "hide": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(
          `${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`,
        );
        lines.push(
          `${condSelector} [${targetAttr}="${when}"] { ${cssBlock(preset.hidden)}; }`,
        );
      } else {
        lines.push(
          `${condSelector} [${targetAttr}="${when}"] { display: none; }`,
        );
      }
      return lines.join("\n");
    }

    // ── Disable ─────────────────────────────────
    case "disable": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(
          `${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`,
        );
      }
      lines.push(
        `${condSelector} [${targetAttr}="${when}"] { opacity: 0.5; pointer-events: none; user-select: none; }`,
      );
      return lines.join("\n");
    }

    // ── Enable ──────────────────────────────────
    case "enable": {
      const lines: string[] = [];
      lines.push(
        `${scopeSelector} [${targetAttr}="${when}"] { opacity: 0.5; pointer-events: none; user-select: none; }`,
      );
      if (isAnimated && preset) {
        lines.push(
          `${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`,
        );
      }
      lines.push(
        `${condSelector} [${targetAttr}="${when}"] { opacity: 1; pointer-events: auto; user-select: auto; }`,
      );
      return lines.join("\n");
    }
  }
}

// ---------------------------------------------------------------------------
// Prop types for sub-components
// ---------------------------------------------------------------------------

type WrapperProps = {
  /** HTML tag to render (default: "div") */
  tag?: string;
  children?: any;
} & Record<string, any>;

type TriggerProps = {
  /** The condition value this trigger represents (e.g. "free", "pro"). */
  value: string;
  children?: any;
};

type EffectProps<E extends string> = {
  /** Condition name: built-in ("valid", "invalid", "checked", etc.) or a value string. */
  when: StateCondition<E>;
  /** HTML tag for the target element (default: "div"). */
  tag?: string;
  /** Animation preset name (fade, slide-up, etc.). */
  animate?: AnimationPresetName;
  /** Custom CSS transition string. Overrides the preset's transition when used with animate. */
  transition?: string;
  children?: any;
} & Record<string, any>;

// ---------------------------------------------------------------------------
// Component factory
// ---------------------------------------------------------------------------

/**
 * Create a scoped Wrapper + Trigger + Show/Hide/Disable/Enable set for
 * CSS-only state-driven interactivity.
 *
 * Call once per "state group" — the returned object is a JSX component
 * for the wrapper, with Trigger, Show, Hide, Disable, and Enable attached
 * as sub-components.
 *
 * @param name  Unique name for this state group. Used in scope IDs and
 *              data attributes.
 * @param opts  Optional configuration (reserved for future use).
 */
export function State<E extends string>(name: E, opts?: { scope?: string }) {
  /** Scope ID used by both the Wrapper and effect components. */
  const scopeId = opts?.scope ?? generateScopeId(name);

  // ── Wrapper ──────────────────────────────────────
  /**
   * Scoping container. Sets data-state-scope (using the scope ID determined
   * when State() was called) and data-state-wrap.
   */
  function Wrapper({ tag, children, ...rest }: WrapperProps) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;

    return (
      <Tag data-state-scope={scopeId} data-state-wrap {...rest}>
        {children}
      </Tag>
    );
  }

  // ── Trigger ──────────────────────────────────────
  /**
   * Wraps a child input with data-state-value, which the condition
   * selector uses to match value-based conditions
   * (e.g. `:has([data-state-value="free"]:checked)`).
   *
   * Merges `data-state-value` into a single child element (mirroring
   * Action.Trigger's child-merging pattern). Falls back to wrapping
   * in a <span> when needed.
   */
  function Trigger({ value, children }: TriggerProps) {
    const inject: Record<string, string> = {
      "data-state-value": value,
    };

    // Single child element — re-render with data-state-value merged in
    if (
      children != null &&
      typeof children === "object" &&
      "tag" in children &&
      !Array.isArray(children)
    ) {
      const ChildTag = (children as any).tag as keyof JSX.IntrinsicElements;
      const childProps = (children as any).props || {};
      const childChildren = (children as any).children;
      return (
        <ChildTag {...childProps} {...inject}>
          {childChildren}
        </ChildTag>
      );
    }

    // Fallback: wrap in a span
    return <span {...inject}>{children}</span>;
  }

  // ── Show ─────────────────────────────────────────
  /**
   * Hidden by default. Revealed when the condition matches.
   *
   * Non-animated: uses the HTML `hidden` attribute (UA stylesheet:
   * display:none). The reveal rule overrides with the correct display
   * value for the target tag.
   *
   * Animated: uses opacity/visibility/pointer-events for the hidden
   * state, which preserves layout space and allows CSS transitions.
   *
   * Emits its own <style> tag inline before the target element.
   */
  function Show({ when, tag, animate, transition, children, ...rest }: EffectProps<E>) {
    const isAnimated = !!(animate ?? transition);
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    const css = generateEffectCSS("show", when, tag ?? "div", scopeId, animate, transition);

    return (
      <>
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <Tag
          data-state-show={when}
          {...(isAnimated ? {} : { hidden: true })}
          {...rest}
        >
          {children}
        </Tag>
      </>
    );
  }

  // ── Hide ─────────────────────────────────────────
  /**
   * Visible by default. Hidden when the condition matches.
   *
   * Non-animated: uses display:none when condition matches.
   * Animated: uses opacity/visibility/pointer-events with transition.
   *
   * Emits its own <style> tag inline before the target element.
   */
  function Hide({ when, tag, animate, transition, children, ...rest }: EffectProps<E>) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    const css = generateEffectCSS("hide", when, tag ?? "div", scopeId, animate, transition);

    return (
      <>
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <Tag data-state-hide={when} {...rest}>
          {children}
        </Tag>
      </>
    );
  }

  // ── Disable ──────────────────────────────────────
  /**
   * Enabled by default. CSS-disabled when the condition matches.
   *
   * Sets opacity: 0.5, pointer-events: none, user-select: none,
   * and aria-disabled="true" on the target. Note: this is a visual
   * approximation — the HTML `disabled` attribute is NOT set.
   *
   * Emits its own <style> tag inline before the target element.
   */
  function Disable({ when, tag, animate, transition, children, ...rest }: EffectProps<E>) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    const css = generateEffectCSS("disable", when, tag ?? "div", scopeId, animate, transition);

    return (
      <>
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <Tag data-state-disable={when} {...rest}>
          {children}
        </Tag>
      </>
    );
  }

  // ── Enable ───────────────────────────────────────
  /**
   * CSS-disabled by default. Enabled when the condition matches.
   *
   * Reversed version of Disable: starts with opacity:0.5,
   * pointer-events:none and transitions to full enablement.
   *
   * Emits its own <style> tag inline before the target element.
   */
  function Enable({ when, tag, animate, transition, children, ...rest }: EffectProps<E>) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    const css = generateEffectCSS("enable", when, tag ?? "div", scopeId, animate, transition);

    return (
      <>
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <Tag data-state-enable={when} {...rest}>
          {children}
        </Tag>
      </>
    );
  }

  // Attach sub-components to Wrapper
  Wrapper.Trigger = Trigger;
  Wrapper.Show = Show;
  Wrapper.Hide = Hide;
  Wrapper.Disable = Disable;
  Wrapper.Enable = Enable;

  return Wrapper;
}
