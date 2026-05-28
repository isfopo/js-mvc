# Nested Frames — Implementation Plan & Drawbacks

## Overview

Nested Frames is an architecture for achieving SPA-like partial page updates within a server-rendered MVC framework, without introducing a client-side routing library or virtual DOM. It uses `<iframe>` elements as composition boundaries, where each "layer" of the page is its own document context that can navigate independently.

The pattern mirrors nested layouts/outlets in frameworks like Next.js or Remix, but achieves it with plain HTML and minimal JavaScript — the server decides what each frame renders based on a depth parameter, and frames communicate through the browser's native `postMessage` API.

---

## 1. Core Concept

### The depth-aware rendering model

Every HTTP request carries a `_depth` query parameter indicating which frame layer is being rendered. The same route handler runs regardless of depth — it's the **layout wrapper** that changes.

| Depth | Role | What it renders |
|---|---|---|
| 0 (no `_depth` param) | Root layout | Global chrome (nav, auth) + `<Outlet />` pointing to depth 1 |
| 1 | Section shell (optional) | Section chrome (sidebar, sub-nav) + `<Outlet />` pointing to depth 2 |
| 2+ | Leaf content | The actual page content, no `<Outlet />` |

A route like `/tenets/new` produces different HTML depending on depth:

**Depth 0** — `/tenets/new` (browser address bar):
```html
<html>
  <head>
    <link rel="stylesheet" href="/.generated/styles/index.css" />
    <script type="module" src="/.generated/client/main.js" />
  </head>
  <body>
    <nav><!-- global nav: logo, auth links --></nav>
    <main>
      <iframe name="frame-1" src="/tenets/new?_depth=1"
              style="width:100%;border:none;"></iframe>
    </main>
  </body>
</html>
```

**Depth 1** — `/tenets/new?_depth=1` (inside the iframe):
```html
<html>
  <head>
    <link rel="stylesheet" href="/.generated/styles/index.css" />
  </head>
  <body>
    <form method="post" action="/tenets">
      <!-- the actual new tenet form — no Outlet, this is a leaf -->
    </form>
  </body>
</html>
```

Two HTTP requests. The layout frame persists across navigations within the content frame.

### The `<Outlet />` component

`<Outlet />` is a server-side JSX component that renders as an `<iframe>`. It only appears in views that have visual chrome surrounding the child content. If a view has no `<Outlet />`, it's a leaf — content renders directly.

```tsx
// Outlet receives the current path and depth from the rendering context
interface OutletProps {
  /** Override the path for this outlet. Used for multi-outlet layouts. */
  path?: string;
}

export function Outlet({ path }: OutletProps) {
  // currentPath and currentDepth come from the rendering context
  const outletPath = path ?? currentPath;
  const outletDepth = currentDepth + 1;
  return (
    <iframe
      name={`frame-${outletDepth}`}
      src={`${outletPath}?_depth=${outletDepth}`}
      style="width:100%;border:none;"
    />
  );
}
```

**Depth is emergent, not declared.** The controller doesn't define depth boundaries. The view template decides whether it's a layout boundary by including or omitting `<Outlet />`. The framework detects Outlets in the rendered output and knows there's a deeper layer.

### The stretch goal: multi-outlet layouts

A section view can contain multiple Outlets, each pointing to a different path:

```tsx
// /tenets at depth 1 — section shell with sidebar + detail
const TenetsSection: FC = () => (
  <div class="tenets-layout">
    <aside>
      <Outlet path="/tenets/list" />
    </aside>
    <div>
      <Outlet path="/tenets/:slug/details" />
    </div>
  </div>
);
```

This enables the sidebar + detail pattern where selecting an item in the sidebar updates the detail pane without reloading the sidebar or the layout.

---

## 2. Implementation Plan

### Phase 1: Depth-Aware Rendering

The foundation — making the server aware of frame depth and rendering different wrappers accordingly.

#### 2.1.1 Rendering context

Add depth and path to the rendering context so views can access them:

```ts
// src/infrastructure/FrameContext.ts

/** Carries frame depth information through the request lifecycle. */
export interface FrameContext {
  /** The current frame depth (0 = top-level, 1+ = nested). */
  depth: number;
  /** The original request path (without _depth param). */
  path: string;
}
```

#### 2.1.2 Depth-aware middleware

A middleware that runs before controllers, extracting `_depth` from the query string and storing it in the Hono context:

```ts
// src/infrastructure/frameMiddleware.ts

import { Context, Next } from "hono";

/**
 * Extract _depth from the query string and store it in the context.
 * Strips _depth from c.req.path so controllers see clean paths.
 */
export async function frameMiddleware(c: Context, next: Next) {
  const depthParam = c.req.query("_depth");
  const depth = depthParam ? parseInt(depthParam, 10) : 0;
  c.set("frameDepth", depth);
  c.set("framePath", c.req.path); // path without _depth
  await next();
}
```

#### 2.1.3 Depth-aware renderer

Modify `ControllerBase.register()` to wrap responses differently based on depth:

```ts
// In ControllerBase.tsx — modified renderer middleware

this._app.use("*", async (c, next) => {
  const depth: number = c.get("frameDepth") ?? 0;

  if (depth === 0) {
    // Top-level: full Layout with <Outlet />
    c.setRenderer((content: any) => {
      const user = (c as any).get("user");
      const doctype = "<!DOCTYPE html>";
      const body = renderToString(
        <Layout user={user} currentPath={c.req.path} depth={depth}>
          {content}
        </Layout>,
      );
      return c.html(doctype + body);
    });
  } else {
    // Nested frame: minimal shell, no global nav
    c.setRenderer((content: any) => {
      const doctype = "<!DOCTYPE html>";
      const body = renderToString(
        <FrameShell depth={depth}>
          {content}
        </FrameShell>,
      );
      return c.html(doctype + body);
    });
  }

  await next();
});
```

#### 2.1.4 The `<Outlet />` component

```tsx
// src/views/components/Outlet/index.tsx

import { FC } from "hono/jsx";

interface OutletProps {
  /** Path for this outlet. Defaults to the current request path. */
  path?: string;
}

/**
 * Outlet renders as an <iframe> pointing to the same path at the next depth.
 * Only used in views that have visual chrome surrounding child content.
 * Views without surrounding chrome render content directly (no Outlet).
 */
export const Outlet: FC<OutletProps> = ({ path }) => {
  // path and depth are injected via a rendering context provider
  // (see FrameContext below)
  const outletPath = path ?? framePath;
  const outletDepth = frameDepth + 1;

  return (
    <iframe
      name={`frame-${outletDepth}`}
      src={`${outletPath}?_depth=${outletDepth}`}
      style="width:100%;border:none;"
      title={path ? `Frame: ${path}` : `Frame depth ${outletDepth}`}
    />
  );
};
```

#### 2.1.5 The `FrameShell` component

For nested frames (depth > 0), a minimal HTML shell that includes CSS but no global nav:

```tsx
// src/views/pages/Shared/FrameShell.tsx

import type { FC, PropsWithChildren } from "hono/jsx";

interface FrameShellProps extends PropsWithChildren {
  depth: number;
}

/**
 * Minimal HTML shell for nested frames.
 * Includes CSS and client JS but no global navigation.
 * The Layout component is only rendered at depth 0.
 */
export const FrameShell: FC<FrameShellProps> = ({ children, depth }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/.generated/styles/index.css" />
      {import.meta.env.DEV ? (
        <>
          <script type="module" src="/@vite/client"></script>
          <script type="module" src="/src/infrastructure/client/main.ts"></script>
        </>
      ) : (
        <script type="module" src="/.generated/client/main.js"></script>
      )}
    </head>
    <body>
      {children}
    </body>
  </html>
);
```

#### 2.1.6 Modified Layout

The existing `Layout` component gains an `<Outlet />` for depth 0:

```tsx
// src/views/pages/Shared/Layout.tsx — modified

import { Outlet } from "views/components/Outlet";

interface LayoutProps extends PropsWithChildren {
  head?: JSXNode;
  user?: Pick<UserRow, "login" | "avatar_url"> | null;
  currentPath?: string;
  depth?: number;  // new
}

export const Layout: FC<LayoutProps> = ({
  children,
  head = "",
  user,
  currentPath = "/",
  depth = 0,
}) => {
  const isHome = currentPath === "/" || currentPath.startsWith("/tenets");

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tenet — Team Decision Journal" />
        <title>Tenet</title>
        <link rel="stylesheet" href="/.generated/styles/index.css" />
        {/* ... scripts ... */}
        {head}
      </head>
      <body>
        <header>
          <nav>{/* ... existing nav ... */}</nav>
        </header>
        <main>
          {/* At depth 0, render an Outlet instead of children directly.
              The controller's view content goes into the iframe. */}
          {depth === 0 ? (
            <Outlet />
          ) : (
            children
          )}
        </main>
      </body>
    </html>
  );
};
```

Wait — this is wrong. At depth 0, the Layout should render the Outlet (which becomes an iframe pointing to depth 1). But the controller handler at depth 0 still runs and produces a view. The question is: **what does the controller produce at depth 0?**

The answer: at depth 0, the controller's view is irrelevant — the Layout itself is the view. The Layout renders the Outlet, and the iframe at depth 1 loads the same path, which runs the same controller again, this time at depth 1, producing the actual content view.

This means the rendering pipeline changes:

```
Request: GET /tenets/new
  → depth 0: Layout renders with Outlet pointing to /tenets/new?_depth=1
  → iframe loads /tenets/new?_depth=1
  → depth 1: Controller runs, view renders inside FrameShell (no Outlet → leaf)
```

The controller handler doesn't need to change. The renderer middleware handles the depth logic:

- **Depth 0**: Render Layout with Outlet. Controller handler is NOT called.
- **Depth 1+**: Render FrameShell with controller's view content. If the view contains an Outlet, FrameShell wraps it; if not, it's a leaf.

Actually, this needs more thought. At depth 0, we still need the controller to run so we can pass data (like `user`) to the Layout. But the controller's view output is discarded — only the Layout matters.

A cleaner approach: **the controller always runs, but the renderer decides what to wrap it in.**

```ts
// Renderer at depth 0:
c.setRenderer((content: any) => {
  const user = c.get("user");
  return c.html("<!DOCTYPE html>" + renderToString(
    <Layout user={user} currentPath={c.req.path} depth={0} />
  ));
});

// Renderer at depth 1+:
c.setRenderer((content: any) => {
  return c.html("<!DOCTYPE html>" + renderToString(
    <FrameShell depth={depth}>{content}</FrameShell>
  ));
});
```

At depth 0, the Layout component itself contains the Outlet. The `content` passed to the renderer is ignored because the Layout is the entire response. At depth 1+, the controller's view content is rendered inside FrameShell.

#### 2.1.7 Frame context provider

Since `<Outlet />` needs to know the current path and depth, and JSX in Hono doesn't have React-style context, we need a way to pass this through. Options:

**Option A: Pass as props through every view.** Simple but verbose — every view component needs `depth` and `path` props.

**Option B: Use a module-level variable set during rendering.** Set it in the renderer middleware, read it in Outlet.

```ts
// src/infrastructure/FrameContext.ts

/** Module-level frame context, set per-request by the renderer. */
let _currentPath: string = "/";
let _currentDepth: number = 0;

export function setFrameContext(path: string, depth: number) {
  _currentPath = path;
  _currentDepth = depth;
}

export function getFramePath() { return _currentPath; }
export function getFrameDepth() { return _currentDepth; }
```

**Option B is simpler but not safe for concurrent requests** (Workers handle one request at a time per isolate, so this is actually fine in Cloudflare Workers). This is the recommended approach for this project.

#### 2.1.8 File changes summary for Phase 1

| File | Change |
|---|---|
| `src/infrastructure/FrameContext.ts` | **New** — frame context module |
| `src/infrastructure/frameMiddleware.ts` | **New** — depth extraction middleware |
| `src/views/pages/Shared/FrameShell.tsx` | **New** — minimal shell for nested frames |
| `src/views/components/Outlet/index.tsx` | **New** — Outlet component |
| `src/infrastructure/ControllerBase.tsx` | **Modify** — depth-aware renderer |
| `src/views/pages/Shared/Layout.tsx` | **Modify** — render Outlet at depth 0 |
| `src/index.tsx` | **Modify** — register frame middleware |

---

### Phase 2: History & Navigation

The back button is the hardest problem. Each iframe has its own browsing history, but the browser's back/forward buttons operate on the top-level history.

#### 2.2.1 The problem

1. User visits `/tenets` (depth 0 loads, iframe loads `/tenets?_depth=1`)
2. User clicks a tenet link inside the iframe → iframe navigates to `/tenets/abc?_depth=1`
3. User presses browser back button → **top-level** page navigates back, not the iframe
4. The entire layout frame reloads, losing all state

#### 2.2.2 The solution: minimal history management

A small script in the top-level frame that:

1. Listens for `postMessage` from child frames announcing navigation
2. Maintains a history stack mapping top-level URLs to iframe states
3. Intercepts `popstate` events and tells the correct iframe to navigate

**Top-level frame script** (`frame-router.js`):

```ts
// src/infrastructure/client/frame-router.ts

/**
 * Minimal history manager for nested frames.
 *
 * Listens for navigation events from child iframes and keeps
 * the browser address bar in sync. Intercepts back/forward
 * and routes them to the correct iframe.
 */

interface HistoryEntry {
  path: string;       // The canonical URL path (for address bar)
  frameId: string;    // Which iframe navigated
  frameSrc: string;   // The iframe's src at this point
}

const historyStack: HistoryEntry[] = [];
let initialized = false;

/** Called when a child iframe navigates. */
function onFrameNavigate(event: MessageEvent) {
  if (event.data?.type !== "frame:navigate") return;
  // Only accept messages from our own iframes
  if (event.source === null) return;

  const { path, frameSrc } = event.data;
  const frameId = findFrameId(event.source);

  if (!frameId) return;

  const entry: HistoryEntry = { path, frameId, frameSrc };
  historyStack.push(entry);

  // Update address bar without reload
  history.pushState({ index: historyStack.length - 1 }, "", path);
}

/** Find the iframe element that sent this message. */
function findFrameId(source: MessageEventSource | null): string | null {
  if (!source) return null;
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    if (iframe.contentWindow === source) {
      return iframe.name || iframe.id || "frame-1";
    }
  }
  return null;
}

/** Handle browser back/forward. */
function onPopState(event: PopStateEvent) {
  // The browser has already navigated — we need to update the iframe
  // to match the new URL
  const targetPath = location.pathname + location.search;
  const frame = document.querySelector("iframe[name='frame-1']") as HTMLIFrameElement;

  if (frame) {
    // Navigate the main content iframe to the new path
    frame.src = targetPath + (targetPath.includes("?") ? "&" : "?") + "_depth=1";
  }
}

/** Initialize the history manager. */
export function initFrameRouter() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("message", onFrameNavigate);
  window.addEventListener("popstate", onPopState);

  // Replace current history entry with our state
  history.replaceState({ index: 0 }, "", location.pathname);
}

export { initFrameRouter };
```

**Child frame script** (injected into every iframe via FrameShell):

```ts
// src/infrastructure/client/frame-child.ts

/**
 * Minimal script injected into every nested frame.
 * Announces navigation to the parent frame so the address bar stays in sync.
 */

function announce() {
  // Strip _depth from the URL before announcing to parent
  const url = new URL(location.href);
  url.searchParams.delete("_depth");

  parent.postMessage({
    type: "frame:navigate",
    path: url.pathname + url.search,
    frameSrc: location.href,
  }, "*");  // TODO: restrict origin in production
}

// Announce on initial load
announce();

// Announce on navigation (links, form submissions)
// We use a navigation observer if available, otherwise patch history methods
if (typeof NavigationObserver !== "undefined") {
  // Future: use NavigationObserver when widely available
} else {
  // Patch pushState/replaceState to catch JS-driven navigations
  const origPush = history.pushState;
  history.pushState = function (...args) {
    origPush.apply(this, args);
    announce();
  };

  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    origReplace.apply(this, args);
    announce();
  };
}
```

#### 2.2.3 Link targeting convention

By default, links inside an iframe target `_self` (the iframe itself). This is the desired behavior for in-section navigation. For cross-section or global navigation, links need `target="_top"`:

```html
<!-- Stays in the current iframe (default) -->
<a href="/tenets/abc">View tenet</a>

<!-- Replaces the entire page (for auth, errors, cross-section) -->
<a href="/auth/login" target="_top">Login</a>
<form action="/auth/logout" method="post" target="_top">...</form>
```

The `FrameShell` component sets a default `<base target="_self">` in its `<head>`, so all links default to staying in their frame. Explicit `target="_top"` overrides this for global navigation.

```tsx
// In FrameShell.tsx
<head>
  <base target="_self" />
  {/* ... */}
</head>
```

#### 2.2.4 File changes summary for Phase 2

| File | Change |
|---|---|
| `src/infrastructure/client/frame-router.ts` | **New** — top-level history manager |
| `src/infrastructure/client/frame-child.ts` | **New** — child frame navigation announcer |
| `src/views/pages/Shared/FrameShell.tsx` | **Modify** — add `<base target="_self">`, include child script |
| `src/views/pages/Shared/Layout.tsx` | **Modify** — include frame-router script |
| `src/infrastructure/client/main.ts` | **Modify** — import and init frame-router (top level only) |

---

### Phase 3: iframe Sizing

iframes don't auto-size to their content. The layout needs explicit sizing.

#### 2.3.1 Strategy: Flexbox + viewport fill

For the primary use case (layout → content), the iframe fills the remaining viewport space:

```css
/* Layout at depth 0 */
body {
  margin: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  flex-shrink: 0;
}

main {
  flex: 1;
  display: flex;
}

main iframe {
  width: 100%;
  height: 100%;
  border: none;
}
```

For the stretch goal (sidebar + detail), the section frame uses CSS Grid:

```css
/* Section at depth 1 */
.tenets-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100vh;
}

aside iframe,
main iframe {
  width: 100%;
  height: 100%;
  border: none;
}
```

#### 2.3.2 Dynamic height (for variable-height content)

When an iframe's content height varies (e.g., a tenet detail page), the iframe needs to match its content height. This requires a small `postMessage` exchange:

```ts
// In FrameShell — observe content height and report to parent
function reportHeight() {
  const height = document.documentElement.scrollHeight;
  parent.postMessage({
    type: "frame:resize",
    height,
  }, "*");
}

// Report on load and on DOM changes
const observer = new ResizeObserver(reportHeight);
observer.observe(document.body);
reportHeight();
```

```ts
// In frame-router — listen for height reports
function onFrameResize(event: MessageEvent) {
  if (event.data?.type !== "frame:resize") return;
  const frameId = findFrameId(event.source);
  if (!frameId) return;

  const iframe = document.querySelector(`iframe[name="${frameId}"]`);
  if (iframe) {
    iframe.style.height = event.data.height + "px";
  }
}
```

**Recommendation:** Use flexbox/viewport fill for the primary layout (Phase 1). Add dynamic height as an enhancement in Phase 3, only for frames that need it.

#### 2.3.3 File changes summary for Phase 3

| File | Change |
|---|---|
| `src/views/pages/Shared/Layout.tsx` | **Modify** — add flexbox styles for iframe sizing |
| `src/views/pages/Shared/FrameShell.tsx` | **Modify** — add height reporting script |
| `src/infrastructure/client/frame-router.ts` | **Modify** — add height listener |
| `src/views/pages/Shared/Layout.module.css` | **New/Modify** — layout styles |

---

### Phase 4: Multi-Outlet (Stretch Goal)

Enabling a single section view to contain multiple Outlets (sidebar + detail).

#### 2.4.1 The URL problem

With two independent frames on the same page, the URL can only represent one canonical state. Options:

**Option A: Primary path wins.** The URL represents the detail view. The sidebar is always `/tenets/list` (or `/tenets`). Selecting a tenet updates the detail iframe and the address bar, but the sidebar doesn't change.

```
URL: /tenets/abc
Sidebar iframe: /tenets?_depth=2  (always the list)
Detail iframe:   /tenets/abc?_depth=2  (changes with selection)
```

**Option B: Query param encoding.** The URL encodes both states:

```
URL: /tenets?detail=abc
Sidebar iframe: /tenets?_depth=2
Detail iframe:   /tenets/abc?_depth=2
```

**Option C: Hash-based routing.** The hash encodes the detail state:

```
URL: /tenets#abc
```

**Recommendation: Option A for v1.** It's the simplest, preserves RESTful URLs, and the sidebar content doesn't change based on selection. The sidebar can highlight the active item via `postMessage` from the detail frame.

#### 2.4.2 Inter-frame communication

When the user clicks a tenet in the sidebar, the detail frame needs to update. Two approaches:

**Approach 1: Via parent.** The sidebar sends a message to the parent, which updates the detail iframe's `src`:

```ts
// Sidebar iframe:
parent.postMessage({
  type: "frame:outlet",
  outlet: "detail",
  path: "/tenets/abc",
}, "*");

// Parent (frame-router):
function onOutletNavigate(event: MessageEvent) {
  if (event.data?.type !== "frame:outlet") return;
  const iframe = document.querySelector(`iframe[name="${event.data.outlet}"]`);
  if (iframe) {
    iframe.src = event.data.path + "?_depth=" + (currentDepth + 1);
  }
}
```

**Approach 2: Direct.** The sidebar directly sets the detail iframe's `src` via `parent.document`. This violates same-origin policy if the frames are on different origins, but since they're all on the same origin, it works:

```ts
// Sidebar iframe:
const detailFrame = parent.document.querySelector('iframe[name="detail"]');
if (detailFrame) {
  detailFrame.src = "/tenets/abc?_depth=2";
}
```

**Recommendation: Approach 1 (via parent).** It keeps the parent as the single source of truth for frame state, which is cleaner for history management and debugging.

#### 2.4.3 Multi-Outlet view example

```tsx
// src/views/pages/Tenets/views/section.tsx

import { FC } from "hono/jsx";
import { Outlet } from "views/components/Outlet";
import styles from "./section.module.css";

/**
 * Section shell for the tenets area.
 * Contains two Outlets: sidebar (list) and detail.
 * Only rendered at depth 1.
 */
export const SectionView: FC = () => (
  <div class={styles.tenetsLayout}>
    <aside>
      <Outlet path="/tenets" />
    </aside>
    <div class={styles.detailPane}>
      <Outlet path="/tenets/:slug" />
    </div>
  </div>
);
```

The controller needs to know which Outlet path to fill based on the request. This is where it gets complex — the section view at depth 1 needs to know the "current" slug to fill the detail Outlet. This requires the controller to pass path parameters down to the view.

#### 2.4.4 File changes summary for Phase 4

| File | Change |
|---|---|
| `src/views/pages/Tenets/views/section.tsx` | **New** — section shell with two Outlets |
| `src/views/pages/Tenets/views/section.module.css` | **New** — grid layout for sidebar + detail |
| `src/views/pages/Tenets/controller.tsx` | **Modify** — add section route at depth 1 |
| `src/infrastructure/client/frame-router.ts` | **Modify** — handle multi-outlet navigation |
| `src/views/components/Outlet/index.tsx` | **Modify** — support named outlets |

---

## 3. Drawbacks & Limitations

### 3.1 Back Button / History — Critical, Solvable

**The problem:** Each iframe has its own browsing history. The browser's back/forward buttons operate on the top-level history, not the iframe's. Without intervention, pressing back after navigating within an iframe navigates the entire page away.

**The solution:** The `frame-router` script (Phase 2) intercepts `popstate` events and routes them to the correct iframe. Child frames announce navigation via `postMessage`.

**Remaining edge cases:**
- **Middle-click / Cmd+Click:** Opens a link in a new tab. The new tab loads the full depth-0 page, which works correctly but loses the iframe context. This is acceptable — it's the same as any SPA that opens a new tab.
- **Deep links:** Someone shares `/tenets/abc`. The top-level page loads, the iframe loads `/tenets/abc?_depth=1`. This works correctly because the depth-0 Layout always renders an Outlet pointing to the same path at depth 1.
- **Forward button:** The `popstate` handler needs to handle both back and forward. The history stack approach handles this, but requires careful testing.
- **Multiple iframes navigating simultaneously:** The stretch goal introduces two iframes that can navigate independently. The history stack needs to track which iframe navigated, so back/forward can be routed correctly. This is solvable but adds complexity.

**Severity: High.** The back button is the most critical UX issue. The solution works but requires ongoing maintenance as edge cases are discovered.

---

### 3.2 iframe Sizing — High, Constrained

**The problem:** iframes don't auto-size to their content. They default to 300×150px and must be explicitly sized.

**The solution:** Use CSS flexbox/grid for fixed layouts (sidebar + detail) and `postMessage`-based height reporting for variable-height content.

**Limitations:**
- **Nested scroll contexts:** Content that overflows the iframe scrolls within the iframe, not the page. This breaks scroll momentum on mobile and creates a "scroll within scroll" UX.
- **ResizeObserver overhead:** Every frame runs a `ResizeObserver` that posts height updates to the parent. For 2-3 frames, this is negligible. For more, it could cause layout thrashing.
- **CSS `height: 100%` requires a chain:** The iframe's height depends on its parent's height, which depends on its parent's height, all the way up to `<html>`. Any break in the chain (`height: auto` on a middle element) causes the iframe to collapse. This is fragile.

**Severity: High for variable-height content, Medium for fixed layouts.** The primary use case (layout → content) works well with flexbox. The stretch goal (sidebar + detail) also works well with grid. Variable-height content in iframes is always awkward.

---

### 3.3 Multi-Outlet URL State — High

**The problem:** With two independent iframes on the same page, the URL can only represent one state. The sidebar and detail pane have independent navigation, but there's only one address bar.

**The solution (Option A):** The URL represents the primary content (detail view). The sidebar state is implicit (always shows the list). Selecting a tenet updates the detail iframe and the address bar.

**Limitations:**
- **Non-restorable sidebar state:** If the sidebar had pagination or filtering, that state is lost on a fresh page load. The sidebar always starts at its default state.
- **Address bar doesn't fully describe the page:** `/tenets/abc` tells you the detail view, but not the sidebar state. This is a minor issue for a list sidebar, but would be a real problem for more complex sidebar states.
- **History ambiguity:** When the user presses back, should the detail iframe go back, or should the sidebar go back? The frame-router routes to the detail iframe by default, which is usually correct but not always.

**Severity: High for complex multi-panel layouts, Medium for simple sidebar + detail.** Option A (primary path wins) is pragmatic for this project. A production system would need Option B (query params) or a more sophisticated state serialization.

---

### 3.4 Form Submissions & Redirects — Medium, Solvable

**The problem:** After a form submission, controllers redirect with `c.redirect()`. Inside an iframe, the redirect happens within the iframe — the top-level page stays put. This is usually desired (partial update), but some redirects need to escape the iframe (auth, errors).

**The solution:** `<base target="_self">` in FrameShell makes all links/forms default to staying in their frame. Explicit `target="_top"` overrides this for global navigation:

```html
<!-- In FrameShell head -->
<base target="_self" />

<!-- Auth forms target the top level -->
<form action="/auth/logout" method="post" target="_top">
```

**Limitations:**
- **Every form author must think about target.** This is a new concern that doesn't exist in a single-document app. Convention helps, but it's still a potential source of bugs.
- **Error pages:** A 404 or 500 inside an iframe shows the error page inside the iframe, which may look odd (error page with nav bar inside a content area that also has a nav bar). The error handler should check depth and render a minimal error page for nested frames.

**Severity: Medium.** Solvable with conventions and a depth-aware error handler.

---

### 3.5 CSS Isolation — Double-Edged Sword

**Blessing:**
- No style conflicts between frames
- Each frame's styles are completely scoped
- CSS Modules and `:has()` selectors work cleanly within their frame

**Curse:**
- Pico CSS must be loaded and parsed in every frame document. With HTTP/2 and caching, the CSS file is downloaded once but parsed N times (once per frame). For Pico CSS (~10KB), this adds ~2-5ms per frame.
- CSS custom properties on `<html>` or `<body>` don't cross frame boundaries. A dark mode toggle in the top-level frame doesn't affect child frames without explicit `postMessage` communication.
- `:has()` selectors can't cross frame boundaries. A selection in the sidebar can't affect styles in the detail pane via CSS.

**Severity: Low for this project.** Pico CSS is small, and the number of frames is 2-3. The inability to share CSS state across frames is the more painful limitation, but it's mitigated by the `postMessage` communication channel.

---

### 3.6 Accessibility — Medium

**The problem:** Each iframe is a separate document context for assistive technology. Screen readers announce frame boundaries ("frame, Tenet detail"), which fragments the reading experience.

**Mitigation:**
- Use `title` attributes on iframes for meaningful announcements: `<iframe title="Tenet details" ...>`
- Use ARIA landmarks within each frame (`<nav>`, `<main>`, `<article>`)
- The `<base target="_self">` convention ensures keyboard tab order flows naturally within each frame

**Remaining issues:**
- Tab order doesn't flow across frames. When a user tabs through the page, they'll tab through the layout frame's elements, then jump into the content frame, then through its elements. The transition is invisible — there's no indication that focus has entered or left a frame.
- Screen reader users hear "frame" announcements between sections, which breaks the illusion of a single-page experience.

**Severity: Medium.** The accessibility is functional but degraded compared to a single-document page. This is a real trade-off of the iframe approach.

---

### 3.7 Developer Experience & Debugging — Low

- **DevTools:** Each iframe is a separate document context. You select the iframe context from a dropdown in the Elements and Console panels. Workable but adds friction.
- **Console:** `console.log` from inside an iframe appears in the same console, but you need to select the right execution context to evaluate expressions.
- **HMR:** Vite's HMR connects per-document. Each iframe establishes its own WebSocket connection. This works but means N connections for N frames. For 2-3 frames, this is fine.
- **Error overlays:** Vite's error overlay renders in the top-level document. An error in an iframe shows a blank frame with no error indication at the top level. The error is visible in the console, but not visually.
- **Network tab:** Each iframe's requests are interleaved with the top-level requests. Filtering by `_depth` param helps identify which frame made which request.

**Severity: Low.** Annoying but not blocking. The debugging friction is real but manageable for a small team.

---

### 3.8 Performance — Low to Medium

| Cost | Per-frame overhead | Mitigation |
|---|---|---|
| HTTP request | 1 per frame | HTTP/2 multiplexes; Cloudflare edge caches |
| HTML parse | ~1-5ms per frame | Small HTML = fast parse |
| CSS parse | Pico CSS ~10KB, ~2-5ms per frame | Cached after first load; parsed independently per frame |
| JS parse + execute | Dispatcher ~2KB, ~1ms per frame | Cached; executed independently per frame |
| Layout | Each frame does independent layout | Small docs = fast layout |
| Memory | ~5-10MB per browsing context | Acceptable for 2-3 frames |

**Initial load:** A 2-frame page costs roughly 2x the initial load of a single-page render, plus ~10-20MB of additional memory. A 3-frame page costs 3x.

**Subsequent navigation:** Clicking a link within a frame only reloads that frame. The layout and other frames stay put. This is ~30-50% faster than a full page reload for typical navigation patterns.

**Break-even point:** For a 2-frame setup, the initial load penalty is ~50-100ms. If a user makes 3+ navigations within the content frame during a session, the total time saved exceeds the initial penalty. For most web apps, this is a net positive.

**Mobile:** Each browsing context costs more memory and CPU on mobile. A 3-frame page on a low-end device could feel sluggish. The 2-frame setup (layout + content) is the recommended maximum for mobile.

**Severity: Low for this project's scale, Medium at production scale.** The performance trade-off is honest: slower initial load, faster subsequent navigations. It doesn't scale to 5+ frame depths or large CSS/JS bundles.

---

### 3.9 Security Considerations

- **Clickjacking:** iframes are susceptible to clickjacking attacks. Since all frames are same-origin, this is not a concern for this architecture — the frames trust each other.
- **`postMessage` origin validation:** The `frame-child.ts` script uses `parent.postMessage(data, "*")` with a wildcard origin. In production, this should be restricted to the app's origin: `parent.postMessage(data, "https://your-app.com")`.
- **`X-Frame-Options` / `Content-Security-Policy`:** These headers must NOT be set to prevent framing, since the app frames itself. If these headers are set by Cloudflare or middleware, they need to allow same-origin framing.

**Severity: Low.** Same-origin framing is secure by default. The `postMessage` origin restriction is a hardening measure, not a critical vulnerability.

---

## 4. Summary: What Can Kill This vs. What's Just Work

| Issue | Severity | Solvable? | Effort |
|---|---|---|---|
| Back button / history | **Critical** | Yes, but fragile | High |
| iframe sizing | High | Yes, with layout constraints | Medium |
| Multi-outlet URL state | High | Yes, changes URL contract | High |
| Form redirect targets | Medium | Yes, convention-based | Low |
| Accessibility | Medium | Partially — frame boundaries always announced | Medium |
| CSS isolation overhead | Low | Negligible with Pico CSS | Low |
| Debugging friction | Low | Annoying but workable | Low |
| Performance (initial load) | Low-Medium | Acceptable at this scale | Low |
| Security | Low | Same-origin, restrict postMessage origins | Low |

**The back button is the make-or-break issue.** If history management works cleanly with minimal JS, the rest is engineering work. If it turns out to be a tangled mess of edge cases, that's the signal that the approach has a structural problem.

**Recommendation:** Implement Phase 1 (depth-aware rendering) and Phase 2 (history management) first. Test the back button thoroughly — deep links, back, forward, form submissions, auth redirects. If Phase 2 works reliably, proceed to Phase 3 (sizing) and Phase 4 (multi-outlet) as stretch goals.