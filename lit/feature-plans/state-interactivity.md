# State() — CSS-Only Interactivity Plan

## Overview

A `State()` factory function — the CSS-only sibling to `Action()`. Declare state-driven relationships (show/hide/reveal/disable) in JSX. The component emits data attributes on elements and a `<style>` block inline that wires them together using `:has()`, `:valid`, `:focus-within`, etc. All CSS generation is automatic — no selectors to write.

Supports optional animated transitions via named presets or custom CSS transition strings.

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| CSS emission | Inline `<style>` per effect component (Show/Hide/etc.) |
| Default hidden mechanism (no animation) | HTML `hidden` attribute on `Show` targets, overridden by generated CSS |
| Hidden mechanism (animated) | `opacity: 0; pointer-events: none; visibility: hidden` — preserves layout, allows transitions |
| Scoping | Scope ID determined at `State()` call time (not render time); optional `scope` option for naming; all wrappers from the same State() call share the scope |
| Disabled effect | CSS-only approximation (`opacity` + `pointer-events` + `aria-disabled`) — no HTML `disabled` attribute |
| Display value inference | `Show`/`Hide` accept a `tag` prop (default `div`); factory maps tag → correct `display` value for reveal rule |

## API Surface

### `State(name, opts?)`

Factory function. Returns the `Wrapper` component with `Trigger`, `Show`, `Hide`, `Disable`, and `Enable` attached as sub-components.

```ts
const Form = State("form");
const Plan = State("plan");
const Nav = State("nav", { scope: "main-nav" });  // named scope
```

The scope ID is determined at `State()` call time (not at render time) since
Hono SSR calls function components during VNode construction (bottom-up:
children before parents). Both the Wrapper and effect components share the
same scope ID from the closure.

If you need multiple independent instances of the same state on one page,
create separate `State()` calls or use the `scope` option for a fixed name.

### Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `Wrapper` (returned) | `tag?`, `children`, HTML attrs | Scoping container. Sets `data-state-scope` (from `opts.scope` or auto-generated) and `data-state-wrap`. |
| `.Trigger` | `value`, `children` | Wraps an input, sets `data-state-value="..."` on it. |
| `.Show` | `when`, `tag?`, `animate?`, `transition?`, `children` | Hidden by default. Revealed when condition matches. Emits `<style>` inline. |
| `.Hide` | `when`, `tag?`, `animate?`, `transition?`, `children` | Visible by default. Hidden when condition matches. Emits `<style>` inline. |
| `.Disable` | `when`, `tag?`, `animate?`, `transition?`, `children` | Enabled by default. CSS-disabled when condition matches. Emits `<style>` inline. |
| `.Enable` | `when`, `tag?`, `animate?`, `transition?`, `children` | CSS-disabled by default. Enabled when condition matches. Emits `<style>` inline. |

### `animate` Presets

| Preset | Effect | Generated CSS |
|--------|--------|---------------|
| `"fade"` | Crossfade between hidden/visible | `transition: opacity 200ms;` hidden state: `opacity: 0; pointer-events: none; visibility: hidden;` |
| `"fade-in"` | Same as `"fade"` | — |
| `"slide-up"` | Fade + slide up | `transition: opacity 200ms, transform 200ms;` hidden: `opacity: 0; transform: translateY(8px); pointer-events: none; visibility: hidden;` |
| `"slide-down"` | Fade + slide down | `transition: opacity 200ms, transform 200ms;` hidden: `opacity: 0; transform: translateY(-8px); pointer-events: none; visibility: hidden;` |
| `"scale"` | Fade + scale | `transition: opacity 200ms, transform 200ms;` hidden: `opacity: 0; transform: scale(0.95); pointer-events: none; visibility: hidden;` |
| `"slide-left"` | Fade + slide left | `transition: opacity 200ms, transform 200ms;` hidden: `opacity: 0; transform: translateX(8px); pointer-events: none; visibility: hidden;` |
| `"slide-right"` | Fade + slide right | `transition: opacity 200ms, transform 200ms;` hidden: `opacity: 0; transform: translateX(-8px); pointer-events: none; visibility: hidden;` |

When `animate` is set on `Show`/`Hide`/`Disable`/`Enable`:

- The element **does not** use `display: none` as the hidden state
- Instead, it uses `opacity: 0; pointer-events: none; visibility: hidden;` (plus any transform from the preset)
- This preserves layout space and allows CSS transitions to animate between states
- The `transition` property is set on the element so it animates when the condition toggles

### `transition` Prop

Overrides the transition string for a preset, or implies a basic opacity fade when used alone:

```tsx
// Custom transition with implied opacity-based hidden state
<Show when="active" transition="opacity 400ms ease-in-out">
```

When `transition` is used without `animate`, it behaves like `animate="fade"` but with the custom transition string instead of `opacity 200ms`.

When `transition` is used with `animate`, it replaces the preset's transition string while keeping its hidden-state styles (transform, etc.).

### Built-in Conditions

| `when=` | CSS Selector | Use Case |
|---------|-------------|----------|
| `"valid"` | `:valid` on wrapper | Show submit when form is valid |
| `"invalid"` | `:invalid` on wrapper | Show error summary |
| `"checked"` | `:has(:checked)` | Any checkbox/radio selected |
| `"unchecked"` | `:not(:has(:checked))` | Nothing selected yet |
| `"focused"` | `:focus-within` | Form field has focus |
| Any other string | `:has([data-state-value="..."]:checked)` | Specific radio/checkbox value |

## Rendered Output

### Basic (no animation)

```tsx
<Plan>
  <Plan.Trigger value="free">
    <input type="radio" name="plan" value="free" />
  </Plan.Trigger>
  <Plan.Trigger value="pro">
    <input type="radio" name="plan" value="pro" />
  </Plan.Trigger>
  <Plan.Show when="free">Free tier details</Plan.Show>
  <Plan.Show when="pro">Pro tier details</Plan.Show>
</Plan>
```

```html
<div data-state-scope="plan-7x3k" data-state-wrap>
  <input type="radio" name="plan" value="free" data-state-value="free" />
  <input type="radio" name="plan" value="pro" data-state-value="pro" />
  <div data-state-show="free" hidden>Free tier details</div>
  <div data-state-show="pro" hidden>Pro tier details</div>
</div>

<style>
  [data-state-scope="plan-7x3k"]:has([data-state-value="free"]:checked)
    [data-state-show="free"] { display: block; }
  [data-state-scope="plan-7x3k"]:has([data-state-value="pro"]:checked)
    [data-state-show="pro"] { display: block; }
</style>
```

### With animate preset

```tsx
<Plan.Show when="pro" animate="fade">Pro tier details</Plan.Show>
```

```html
<div data-state-show="pro" data-state-animate="fade">Pro tier details</div>
```

```css
[data-state-scope="plan-7x3k"] [data-state-show="pro"] {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 200ms;
}
[data-state-scope="plan-7x3k"]:has([data-state-value="pro"]:checked)
  [data-state-show="pro"] {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}
```

### With custom transition

```tsx
<Plan.Show when="pro" animate="slide-up" transition="opacity 400ms, transform 400ms">
  Pro tier details
</Plan.Show>
```

Uses the `slide-up` hidden state (`translateY(8px)`) but with a custom 400ms transition.

## Full Examples

### Form Validity

```tsx
const FormState = State("form");

<FormState tag="form">
  <input required name="email" type="email" />
  <input required name="name" />
  <FormState.Show when="valid" animate="fade">
    <button type="submit">Submit</button>
  </FormState.Show>
  <FormState.Show when="invalid" animate="slide-down">
    <p class="error">Please fill out all fields</p>
  </FormState.Show>
</FormState>
```

### Disable Until Checked

```tsx
const Confirm = State("confirm");

<Confirm>
  <label>
    <input type="checkbox" /> I agree to the terms
  </label>
  <Confirm.Disable when="unchecked">
    <button type="submit">Submit</button>
  </Confirm.Disable>
</Confirm>
```

### Radio-Driven Content Switching

```tsx
const Color = State("color");

<Color>
  <Color.Trigger value="red">
    <input type="radio" name="color" value="red" /> Red
  </Color.Trigger>
  <Color.Trigger value="blue">
    <input type="radio" name="color" value="blue" /> Blue
  </Color.Trigger>

  <Color.Show when="red">You chose red</Color.Show>
  <Color.Show when="blue">You chose blue</Color.Show>
</Color>
```

### Disable Until Checked

```tsx
const Confirm = State("confirm");

<Confirm.Wrapper>
  <label>
    <input type="checkbox" /> I agree to the terms
  </label>
  <Confirm.Disable when="unchecked">
    <button type="submit">Submit</button>
  </Confirm.Disable>
</Confirm.Wrapper>
```

### Radio-Driven Content Switching

```tsx
const Color = State("color");

<Color.Wrapper>
  <Color.Trigger value="red">
    <input type="radio" name="color" value="red" /> Red
  </Color.Trigger>
  <Color.Trigger value="blue">
    <input type="radio" name="color" value="blue" /> Blue
  </Color.Trigger>

  <Color.Show when="red" animate="slide-right">You chose red</Color.Show>
  <Color.Show when="blue" animate="slide-right">You chose blue</Color.Show>
</Color.Wrapper>
```

### Named Scope (shared state)

```tsx
const NavMenu = State("nav", { scope: "mobile-nav" });

<NavMenu>
  <NavMenu.Trigger value="open">
    <button>☰ Menu</button>
  </NavMenu.Trigger>
  <NavMenu.Show when="open" tag="nav" animate="slide-down">
    <a href="/">Home</a>
    <a href="/about">About</a>
  </NavMenu.Show>
</NavMenu>
```

## File to Create

```
src/utils/State.tsx
```

Single file. The entire feature lives in one module, mirroring `Action.tsx`.

## Implementation Details

### Scope ID Generation

Auto-generated IDs use the state name + a counter:

```ts
let scopeIdCounter = 0;

function generateScopeId(name: string): string {
  return `${name}-${++scopeIdCounter}`;
}
```

When `scope` option is provided to `State()`, use it directly instead.

### Tag → Display Mapping

Used by `Show` and `Hide` to emit the correct `display` value in reveal rules:

```ts
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
```

Default fallback: `"block"`.

### Animation Presets

```ts
interface AnimationPreset {
  /** CSS properties for the hidden state */
  hidden: Record<string, string>;
  /** Default transition string */
  transition: string;
}

const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  fade: {
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
  scale: {
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
```

### CSS Rule Generation

Each `Show`/`Hide`/`Disable`/`Enable` call generates its own `<style>` block inline before the target element. The scope ID is embedded in the CSS selector (e.g. `[data-state-scope="plan-13"]`). No buffer or collection mechanism is needed — the scope ID is determined at `State()` call time and shared via closure.

### Scoping Model

The scope ID is pre-generated during `State()` (counter-based for auto-generated IDs, or explicit via `opts.scope`). Both the Wrapper and all effect components from the same `State()` call share the same scope ID. This means:

- **Same State(), one page instance** → unique scope, no interference
- **Same State(), multiple wrappers** → shared scope, they share state
- **Different State() calls** → different scopes, independent state
- **Explicit `opts.scope`** → predictable, testable scope IDs

### CSS Effect Rules

| Effect | Default State | Condition Met |
|--------|---------------|---------------|
| Show (no anim) | `display: none` (via `hidden`) | `display: {tag}` |
| Show (animated) | Preset hidden (opacity/vis/p-e) + `transition: ...` | `opacity: 1; pointer-events: auto; visibility: visible;` |
| Hide (no anim) | Visible (no override) | `display: none` |
| Hide (animated) | Visible (no override) | Preset hidden + transition |
| Disable | `opacity: 1; pointer-events: auto` | `opacity: 0.5; pointer-events: none; user-select: none` + `aria-disabled="true"` |
| Enable | `opacity: 0.5; pointer-events: none` | `opacity: 1; pointer-events: auto` |

The generated condition rule for `Disable`/`Enable` also sets `aria-disabled="true"`.

### Trigger Child Merging

`Trigger` follows the same pattern as `Action.Trigger` — it injects `data-state-value` into its single child element, or wraps in a `<span>` if the child can't be merged.

## Type Registry

Analogous to `HandlerActions` in `Action.tsx`:

```ts
export interface StateConditions {
  form: "valid" | "invalid" | "focused";
  confirm: "checked" | "unchecked";
  plan: "free" | "pro" | "checked" | "unchecked";
  color: "red" | "blue" | "checked" | "unchecked";
}
```

Built-in conditions (`"valid"`, `"invalid"`, `"checked"`, `"unchecked"`, `"focused"`) are always available as `when` values regardless of registry entries. The registry adds autocomplete for state-specific values (like `"free"` and `"pro"` for the `plan` state).

## Epics & Milestones

### Epic 1 — Core Factory

- [x] Design reviewed and approved
- [ ] Create `src/utils/State.tsx` with the factory function, scope ID generation, and condition/effect type interfaces
- [ ] Implement `Wrapper` — scoping container, inline `<style>` emission, scope prop
- [ ] Implement `Trigger` — child merging, `data-state-value` injection
- [ ] Implement `Show` — `hidden` attribute, tag→display mapping, conditional reveal rule
- [ ] Implement `Hide` — visible by default, conditional hide rule
- [ ] Implement built-in condition mapping (`valid` → `:valid`, `invalid` → `:invalid`, `checked` → `:has(:checked)`, etc.)
- [ ] Verify basic example renders correctly with SSR (inspect generated HTML + CSS)

### Epic 2 — Animation & Transitions

- [ ] Define animation presets table (`fade`, `slide-up`, `slide-down`, `scale`, `slide-left`, `slide-right`)
- [ ] Implement `animate` prop parsing and preset-to-CSS generation
- [ ] Implement animated hiding strategy (opacity/visibility/pointer-events instead of `display: none`)
- [ ] Implement `transition` prop for custom transition strings (overrides preset, implies opacity-fade when used alone)
- [ ] Verify animated Show/Hide renders and transitions work in browser
- [ ] Verify `transition` + `animate` combination (preset hidden state but custom timing)

### Epic 3 — Disable & Enable Effects

- [ ] Implement `Disable` — opacity + pointer-events + aria-disabled
- [ ] Implement `Enable` — reversed default/condition states
- [ ] Verify `animate`/`transition` works with Disable/Enable (fade the disabled state)
- [ ] Verify with a "disable until checked" example

### Epic 4 — Named Scopes & Deduplication

- [x] Scope ID determined at `State()` call time (counter-based auto, or explicit `opts.scope`)
- [ ] Document that multiple wrappers from the same State() share scope
- [ ] Verify two wrappers with the same named scope share state correctly

### Epic 5 — Type Safety

- [ ] Add `StateConditions` registry interface alongside `HandlerActions`
- [ ] Wire generics so `when=` is typed on `Show`, `Hide`, `Disable`, `Enable`
- [ ] Type the `animate` prop as a union of known preset names
- [ ] Document how to extend the registry in `State.tsx` header

### Epic 6 — Integration & Docs

- [ ] Refactor one existing view to use `State()` (e.g. part of the tenets vote form)
- [ ] Verify no CSS conflicts with CSS Modules or Pico CSS
- [ ] Verify `:has()` works in the project's browser targets (Safari 15.4+)
- [ ] Verify animated transitions work in target browsers (`@starting-style` not needed — using opacity/visibility approach instead of `display: none`)
- [ ] Add `State()` documentation to `AGENTS.md` alongside `Action()`

## Non-Goals

- **No build-time CSS extraction** — all CSS is emitted inline at render time
- **No server-side context/collector** — each effect emits its own `<style>`
- **No "disable" HTML attribute** — CSS-only approximation only
- **No `@starting-style` usage** — animation approach avoids `display: none` toggles, relying on opacity/visibility which are natively animatable in all browsers
- **No complex choreography** — no staggered animations, no delay chaining, no WAAPI
- **No global state sharing** across page boundaries — scoped to wrapper tree
