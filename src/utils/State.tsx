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
 *   // No custom values — accepts any string for `when`
 *   const Form = State("form");
 *
 *   // Typed values — `when` is restricted to the union
 *   const Plan = State<"plan", "free" | "pro" | "enterprise">("plan");
 *
 *   <Plan>
 *     <Plan.Trigger value="free">
 *       <input type="radio" name="plan" value="free" />
 *     </Plan.Trigger>
 *     <Plan.Show when="free">Free tier</Plan.Show>
 *     <Plan.Show when="pro">Pro tier</Plan.Show>
 *   </Plan>
 *
 * Each Wrapper auto-generates a unique scope ID (e.g. "plan-1")
 * and emits a <style> block with scoped CSS rules. Provide a `scope` prop
 * to use a fixed name instead.
 *
 * Animation presets (fade, slide-up, slide-down, scale, slide-left, slide-right)
 * switch from display:none to opacity/visibility/transform so CSS transitions
 * can animate. A custom `transition` prop overrides the preset's timing.
 */

import { JSX } from "hono/jsx";
import { generateEffectCSS } from "./State.css";
import { generateScopeId } from "./State.scope";
import type { WrapperProps, TriggerProps, EffectProps, AnimationPresetName, BuiltInCondition } from "./State.types";

// Re-export types for consumers
export type { StateCondition, WrapperProps, TriggerProps, EffectProps, AnimationPresetName, BuiltInCondition } from "./State.types";
export { _clearStateBuffer } from "./State.scope";

/**
 * Create a scoped Wrapper + Trigger + Show/Hide/Disable/Enable set for
 * CSS-only state-driven interactivity.
 *
 * @typeParam E  State name (used in scope IDs and data attributes)
 * @typeParam V  Allowed condition values for `when` (defaults to `string`)
 *
 * @param name  Unique name for this state group
 * @param opts  Optional configuration (e.g. fixed scope name)
 */
export function State<E extends string, V extends string = string>(name: E, opts?: { scope?: string }) {
  const scopeId = opts?.scope ?? generateScopeId(name);

  function Wrapper({ tag, children, ...rest }: WrapperProps) {
    const Tag = (tag ?? "div") as keyof JSX.IntrinsicElements;
    return (
      <Tag data-state-scope={scopeId} data-state-wrap {...rest}>
        {children}
      </Tag>
    );
  }

  function Trigger({ value, children }: TriggerProps) {
    const inject: Record<string, string> = { "data-state-value": value };

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

    return <span {...inject}>{children}</span>;
  }

  function Show({ when, tag, animate, transition, children, ...rest }: EffectProps<V>) {
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

  function Hide({ when, tag, animate, transition, children, ...rest }: EffectProps<V>) {
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

  function Disable({ when, tag, animate, transition, children, ...rest }: EffectProps<V>) {
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

  function Enable({ when, tag, animate, transition, children, ...rest }: EffectProps<V>) {
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

  Wrapper.Trigger = Trigger;
  Wrapper.Show = Show;
  Wrapper.Hide = Hide;
  Wrapper.Disable = Disable;
  Wrapper.Enable = Enable;

  return Wrapper;
}
