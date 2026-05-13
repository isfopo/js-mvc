import type { AnimationPreset, AnimationPresetName } from "./State.types";

export const TAG_DISPLAY: Record<string, string> = {
  div: "block", span: "inline", p: "block", a: "inline",
  nav: "block", section: "block", article: "block", aside: "block",
  header: "block", footer: "block", main: "block",
  ul: "block", ol: "block", li: "list-item",
  table: "table", tr: "table-row", td: "table-cell", th: "table-cell",
  form: "block", button: "inline-block", label: "inline", fieldset: "block",
  h1: "block", h2: "block", h3: "block", h4: "block", h5: "block", h6: "block",
};

export const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
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

export function buildConditionSelector(condition: string, scopeSelector: string): string {
  switch (condition) {
    case "valid": return `${scopeSelector}:valid`;
    case "invalid": return `${scopeSelector}:invalid`;
    case "checked": return `${scopeSelector}:has(:checked)`;
    case "unchecked": return `${scopeSelector}:not(:has(:checked))`;
    case "focused": return `${scopeSelector}:focus-within`;
    default: return `${scopeSelector}:has([data-state-value="${condition}"]:checked)`;
  }
}

function toCSSProp(jsx: string): string {
  return jsx.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function cssBlock(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([k, v]) => `${toCSSProp(k)}: ${v}`)
    .join("; ");
}

export function generateEffectCSS(
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
    case "show": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(`${scopeSelector} [${targetAttr}="${when}"] { ${cssBlock(preset.hidden)}; transition: ${transitionString}; }`);
      }
      if (isAnimated) {
        lines.push(`${condSelector} [${targetAttr}="${when}"] { opacity: 1; pointer-events: auto; visibility: visible; }`);
      } else {
        lines.push(`${condSelector} [${targetAttr}="${when}"] { display: ${displayValue} !important; }`);
      }
      return lines.join("\n");
    }
    case "hide": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(`${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`);
        lines.push(`${condSelector} [${targetAttr}="${when}"] { ${cssBlock(preset.hidden)}; }`);
      } else {
        lines.push(`${condSelector} [${targetAttr}="${when}"] { display: none; }`);
      }
      return lines.join("\n");
    }
    case "disable": {
      const lines: string[] = [];
      if (isAnimated && preset) {
        lines.push(`${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`);
      }
      lines.push(`${condSelector} [${targetAttr}="${when}"] { opacity: 0.5; pointer-events: none; user-select: none; }`);
      return lines.join("\n");
    }
    case "enable": {
      const lines: string[] = [];
      lines.push(`${scopeSelector} [${targetAttr}="${when}"] { opacity: 0.5; pointer-events: none; user-select: none; }`);
      if (isAnimated && preset) {
        lines.push(`${scopeSelector} [${targetAttr}="${when}"] { transition: ${transitionString}; }`);
      }
      lines.push(`${condSelector} [${targetAttr}="${when}"] { opacity: 1; pointer-events: auto; user-select: auto; }`);
      return lines.join("\n");
    }
  }
}
