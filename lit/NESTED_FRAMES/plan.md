# Nested Frames — Step-by-Step Implementation Plan

This plan translates the design in `NESTED_FRAMES.md` into concrete, ordered tasks. Each task specifies exact files, code changes, verification steps, and dependencies.

---

## Phase 1: Depth-Aware Rendering (Foundation)

The core change: the server renders different HTML depending on the `_depth` query parameter. At depth 0, the full `Layout` wraps content in an `<Outlet />` (which becomes an `<iframe>`). At depth 1+, `FrameShell` wraps content with no global nav.

---

### Task 1.1 — Create `FrameContext.ts`

**File:** `src/infrastructure/FrameContext.ts` (new)

**What:** Module-level frame context that stores the current request's depth and path. Since Cloudflare Workers handle one request at a time per isolate, module-level state is safe for concurrent requests.

```ts
// src/infrastructure/FrameContext.ts

/** Carries frame depth information through the request lifecycle. */
export interface FrameContext {
  /** The current frame depth (0 = top-level, 1+ = nested). */
  depth: number;
  /** The original request path (without _depth param). */
  path: string;
}

// Module-level state — safe in Cloudflare Workers (one request per isolate)
let _currentPath: string = "/";
let _currentDepth: number = 0;

/** Set the frame context for the current request. Called by frameMiddleware. */
export function setFrameContext(path: string, depth: number): void {
  _currentPath = path;
  _currentDepth = depth;
}

/** Get the current request path (without _depth). */
export function getFramePath(): string {
  return _currentPath;
}

/** Get the current frame depth. */
export function getFrameDepth(): number {
  return _currentDepth;
}
```

**Verify:** `npx tsc --noEmit` passes. The file compiles without errors.

**Dependencies:** None.

---

### Task 1.2 — Create `frameMiddleware.ts`

**File:** `src/infrastructure/frameMiddleware.ts` (new)

**What:** A Hono middleware that extracts `_depth` from the query string, stores it in the Hono context variables, and calls `setFrameContext()` so that JSX components (like `<Outlet />`) can read it without needing Hono context.

```ts
// src/infrastructure/frameMiddleware.ts

import type { Context, Next } from "hono";
import { setFrameContext } from "./FrameContext";

/**
 * Extract _depth from the query string and store it in the context.
 * Also sets module-level frame context so JSX components can read it.
 *
 * - Depth 0: top-level page request (no _depth param)
 * - Depth 1+: nested iframe request
 */
export async function frameMiddleware(c: Context, next: Next): Promise<void> {
  const depthParam = c.req.query("_depth");
  const depth = depthParam ? parseInt(depthParam, 10) : 0;
  const path = c.req.path; // path without query string

  // Store in Hono context for middleware/handler access
  c.set("frameDepth", depth);
  c.set("framePath", path);

  // Store in module-level context for JSX component access
  setFrameContext(path, depth);

  await next();
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Task 1.1 (imports `setFrameContext`).

---

### Task 1.3 — Create the `Outlet` component

**File:** `src/views/components/Outlet/index.tsx` (new)

**What:** A server-side JSX component that renders as an `<iframe>` pointing to the same path at the next depth level. Views include `<Outlet />` when they have chrome to wrap around child content.

```tsx
// src/views/components/Outlet/index.tsx

import type { FC } from "hono/jsx";
import { getFramePath, getFrameDepth } from "infrastructure/FrameContext";

interface OutletProps {
  /** Override the path for this outlet. Used for multi-outlet layouts (Phase 4). */
  path?: string;
}

/**
 * Outlet renders as an <iframe> pointing to the same path at the next depth.
 *
 * Only used in views that have visual chrome surrounding child content.
 * Views without surrounding chrome render content directly (no Outlet).
 */
export const Outlet: FC<OutletProps> = ({ path }) => {
  const outletPath = path ?? getFramePath();
  const outletDepth = getFrameDepth() + 1;

  // Build the iframe src: same path with _depth incremented
  const src = outletPath.includes("?")
    ? `${outletPath}&_depth=${outletDepth}`
    : `${outletPath}?_depth=${outletDepth}`;

  return (
    <iframe
      name={`frame-${outletDepth}`}
      src={src}
      style="width:100%;height:100%;border:none;"
      title={path ? `Frame: ${path}` : `Frame depth ${outletDepth}`}
    />
  );
};
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Task 1.1 (imports `getFramePath`, `getFrameDepth`).

---

### Task 1.4 — Create the `FrameShell` component

**File:** `src/views/pages/Shared/FrameShell.tsx` (new)

**What:** A minimal HTML shell for nested frames (depth > 0). Includes CSS and client JS but no global navigation. Sets `<base target="_self">` so links/forms stay inside their frame by default.

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
      {/* Links/forms default to staying in this frame */}
      <base target="_self" />
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

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** None.

---

### Task 1.5 — Modify `ControllerBase.tsx` — depth-aware renderer

**File:** `src/infrastructure/ControllerBase.tsx` (modify)

**What:** Change the renderer middleware to wrap responses differently based on depth:
- **Depth 0:** Render `<Layout>` with `depth={0}`. The Layout itself renders an `<Outlet />` instead of `{children}`. The controller's view content is discarded at depth 0 — only the Layout shell matters.
- **Depth 1+:** Render `<FrameShell>` wrapping the controller's view content.

**Current code** (lines 94–106):
```ts
this._app.use("*", async (c, next) => {
  c.setRenderer((content: any) => {
    const user = (c as any).get("user");
    const doctype = "<!DOCTYPE html>";
    const body = renderToString(
      <Layout user={user} currentPath={c.req.path}>
        {content}
      </Layout>,
    );
    return c.html(doctype + body);
  });
  await next();
});
```

**New code:**
```ts
this._app.use("*", async (c, next) => {
  const depth: number = c.get("frameDepth") ?? 0;

  if (depth === 0) {
    // Top-level: full Layout with Outlet (iframe pointing to depth 1).
    // The controller's view content is discarded at depth 0 —
    // the Layout itself is the entire response.
    c.setRenderer((content: any) => {
      const user = (c as any).get("user");
      const doctype = "<!DOCTYPE html>";
      const body = renderToString(
        <Layout user={user} currentPath={c.req.path} depth={0} />,
      );
      return c.html(doctype + body);
    });
  } else {
    // Nested frame: minimal shell, no global nav.
    // The controller's view content is rendered inside FrameShell.
    c.setRenderer((content: any) => {
      const doctype = "<!DOCTYPE html>";
      const body = renderToString(
        <FrameShell depth={depth}>{content}</FrameShell>,
      );
      return c.html(doctype + body);
    });
  }

  await next();
});
```

Also add the import for `FrameShell` at the top of the file:
```ts
import { FrameShell } from "views/pages/Shared/FrameShell";
```

**Important note:** At depth 0, the controller handler still runs (for side effects like auth checks, data fetching, etc.), but its view output is ignored. The Layout renders the `<Outlet />` which becomes an `<iframe src="/same-path?_depth=1">`. The iframe triggers a second request to the same path at depth 1, which runs the controller again and renders the actual view content inside `FrameShell`.

**Verify:** Run `npm run dev`. Visit any page — it should still render normally (depth 0 renders Layout). Manually visit a page with `?_depth=1` — it should render the view content inside FrameShell (no nav, no Layout chrome).

**Dependencies:** Tasks 1.2, 1.3, 1.4 (needs FrameShell, frameMiddleware running).

---

### Task 1.6 — Modify `Layout.tsx` — render Outlet at depth 0

**File:** `src/views/pages/Shared/Layout.tsx` (modify)

**What:** Add a `depth` prop. At depth 0, render `<Outlet />` inside `<main>` instead of `{children}`. At depth > 0 (shouldn't happen since Layout is only used at depth 0, but for safety), render `{children}`.

**Current interface** (lines 4–10):
```ts
interface LayoutProps extends PropsWithChildren {
  head?: JSXNode;
  user?: Pick<UserRow, "login" | "avatar_url"> | null;
  currentPath?: string;
}
```

**New interface:**
```ts
interface LayoutProps extends PropsWithChildren {
  head?: JSXNode;
  user?: Pick<UserRow, "login" | "avatar_url"> | null;
  currentPath?: string;
  depth?: number;
}
```

**Current render** (line 95):
```tsx
<main>{children}</main>
```

**New render:**
```tsx
<main>
  {depth === 0 ? <Outlet /> : children}
</main>
```

Add the import at the top:
```ts
import { Outlet } from "views/components/Outlet";
```

Update the destructured props (line 13):
```ts
export const Layout: FC<LayoutProps> = ({
  children,
  head = "",
  user,
  currentPath = "/",
  depth = 0,
}) => {
```

**Verify:** Run `npm run dev`. Visit `/tenets`. The page should render the Layout with an `<iframe>` inside `<main>` pointing to `/tenets?_depth=1`. The iframe should load and display the tenets list content inside FrameShell.

**Dependencies:** Tasks 1.3, 1.5 (needs Outlet component and depth-aware renderer).

---

### Task 1.7 — Modify `auth.tsx` — depth-aware redirects

**File:** `src/middlewares/auth.tsx` (modify)

**What:** When `requireAuth()` redirects at depth > 0, the redirect must break out of the iframe using an HTML response with `window.top.location` instead of a server-side redirect. A server-side redirect inside an iframe would only redirect the iframe, leaving the top-level page stuck.

**Current redirect logic** (lines 34–36):
```ts
if (!sessionId) {
  const dest = encodeURIComponent(c.req.path);
  return c.redirect(`/auth/login?redirect=${dest}`);
}
```

And (lines 46–48):
```ts
const dest = encodeURIComponent(c.req.path);
return c.redirect(`/auth/login?redirect=${dest}`);
```

**New logic** — add a helper function and modify the redirect calls:

Add at the top of the file, after the imports:
```ts
import { getFrameDepth } from "infrastructure/FrameContext";
```

Add a helper function before `requireAuth`:
```ts
/**
 * Redirect to a URL, breaking out of the iframe if at depth > 0.
 * At depth 0, uses a normal HTTP redirect.
 * At depth > 0, returns an HTML page that sets window.top.location
 * to break out of the iframe.
 */
function frameRedirect(c: Context, url: string): Response {
  const depth = getFrameDepth();
  if (depth === 0) {
    return c.redirect(url);
  }
  // Inside an iframe — must break out to the top-level window
  const html = `<!DOCTYPE html><html><head><script>window.top.location = ${JSON.stringify(url)};</script></head><body></body></html>`;
  return c.html(html);
}
```

Then replace the three `c.redirect(...)` calls in `requireAuth()`:

1. Line 36: `return c.redirect(\`/auth/login?redirect=${dest}\`);` → `return frameRedirect(c, \`/auth/login?redirect=${dest}\`);`
2. Line 48: `return c.redirect(\`/auth/login?redirect=${dest}\`);` → `return frameRedirect(c, \`/auth/login?redirect=${dest}\`);`
3. Line 68: `return c.redirect("/auth/login");` → `return frameRedirect(c, "/auth/login");`

**Verify:** Run `npm run dev`. Visit a protected page without being logged in. At depth 0, you should be redirected to `/auth/login?redirect=...` as before. At depth 1 (add `?_depth=1` to the URL), the redirect should break out of the iframe and navigate the top-level window.

**Dependencies:** Task 1.1 (imports `getFrameDepth`).

---

### Task 1.8 — Modify `handleError` — depth-aware error rendering

**File:** `src/infrastructure/errors/index.tsx` (modify)

**What:** At depth > 0, errors should render inside `FrameShell` instead of `Layout`. Error pages inside an iframe should not show the global nav again.

Add imports at the top:
```ts
import { getFrameDepth } from "infrastructure/FrameContext";
import { FrameShell } from "views/pages/Shared/FrameShell";
```

Modify the `handleError` function. Currently it renders `<ResultsView>` which wraps content in `<Layout>`. We need to check depth and wrap in `FrameShell` instead when depth > 0.

The current `handleError` function returns `c.html(<ResultsView ...>)` in each error case. We need to wrap the entire function body with a depth check.

**Strategy:** Create a helper that wraps the error content in the appropriate shell based on depth:

```ts
function renderErrorShell(content: JSX.Element): string {
  const depth = getFrameDepth();
  const doctype = "<!DOCTYPE html>";
  if (depth === 0) {
    // At depth 0, ResultsView already includes Layout — use as-is
    return doctype + renderToString(content);
  }
  // At depth > 0, wrap in FrameShell instead of Layout
  return doctype + renderToString(<FrameShell depth={depth}>{content}</FrameShell>);
}
```

But there's a problem: `ResultsView` currently wraps content in `<Layout>` unconditionally. We need to modify `ResultsView` to accept a `depth` prop and conditionally skip the Layout wrapper.

**File:** `src/views/pages/Shared/Results.tsx` (modify)

Add a `depth` prop:
```tsx
export interface ResultsViewProps {
  variant: "success" | "error" | "info";
  message?: string;
  error?: AppError | Error;
  depth?: number;
}
```

Modify the component to conditionally wrap in Layout:
```tsx
export const ResultsView: FC<ResultsViewProps> = ({ variant, message, error, depth = 0 }) => {
  const title = message ?? DEFAULT_ERROR_MESSAGE;
  const isAppError = error instanceof AppError;

  const subheader = isAppError && error.statusCode
    ? `Error ${error.statusCode}`
    : undefined;

  const fieldErrors = error instanceof ValidationError && error.fields
    ? Object.entries(error.fields).map(([field, msg]) => (
        <li>
          <strong>{field}:</strong> {msg}
        </li>
      ))
    : null;

  const content = (
    <Alert variant={variant} header={title} subheader={subheader}>
      {fieldErrors && <ul>{fieldErrors}</ul>}
    </Alert>
  );

  // At depth > 0, don't wrap in Layout — FrameShell handles that in handleError
  if (depth > 0) {
    return content;
  }

  return (
    <Layout>
      {content}
    </Layout>
  );
};
```

Then modify `handleError` in `src/infrastructure/errors/index.tsx`:

```ts
import { renderToString } from "hono/jsx/dom/server";
import { getFrameDepth } from "infrastructure/FrameContext";
import { FrameShell } from "views/pages/Shared/FrameShell";
```

Replace each `c.html(<ResultsView ...>)` call with a depth-aware version. The cleanest approach is to modify the function to check depth once:

```ts
export function handleError(
  c: Context,
  error: unknown,
): Response | Promise<Response> {
  const depth = getFrameDepth();

  // Helper to render error in the appropriate shell
  function renderError(variant: "success" | "error" | "info", message: string, error?: AppError | Error, statusCode?: number): Response {
    if (statusCode) {
      c.status(statusCode);
    }

    const content = <ResultsView variant={variant} message={message} error={error} depth={depth} />;

    if (depth === 0) {
      // ResultsView wraps in Layout at depth 0
      return c.html("<!DOCTYPE html>" + renderToString(content));
    }

    // At depth > 0, wrap in FrameShell
    return c.html("<!DOCTYPE html>" + renderToString(
      <FrameShell depth={depth}>{content}</FrameShell>,
    ));
  }

  if (error instanceof NotFoundError) {
    return renderError("error", error.message, error, 404);
  }
  if (error instanceof UnauthorizedError) {
    return renderError("error", error.message, error, 401);
  }
  if (error instanceof ForbiddenError) {
    return renderError("error", error.message, error, 403);
  }
  if (error instanceof ValidationError) {
    return renderError("error", error.message, error, 400);
  }
  if (error instanceof ConflictError) {
    return renderError("error", error.message, error, 409);
  }
  if (error instanceof RateLimitError) {
    return renderError("error", error.message, error, 429);
  }
  if (error instanceof ServerError) {
    return renderError("error", error.message, error, 500);
  }
  if (error instanceof AppError) {
    return renderError("error", error.message, error, error.statusCode);
  }

  return renderError(
    "error",
    error instanceof Error ? error.message : "Unknown error",
    error instanceof Error ? error : undefined,
    500,
  );
}
```

**Verify:** Run `npm run dev`. Visit a non-existent page at depth 0 — should see full Layout with error. Visit a non-existent page at depth 1 (`/nonexistent?_depth=1`) — should see error content in FrameShell (no nav).

**Dependencies:** Tasks 1.1, 1.4 (imports `getFrameDepth`, `FrameShell`).

---

### Task 1.9 — Modify `index.tsx` — register frame middleware

**File:** `src/index.tsx` (modify)

**What:** Add the `frameMiddleware` to the app before controllers are registered. This must run before any controller so that `frameDepth` and `framePath` are available in the Hono context and `setFrameContext()` has been called.

Add import at the top:
```ts
import { frameMiddleware } from "infrastructure/frameMiddleware";
```

Add the middleware after the database initialization middleware and before controller registration. Insert between lines 43 and 45:

```ts
// Extract frame depth from query string
app.use("*", frameMiddleware);
```

The full `index.tsx` should look like:

```ts
import { Hono } from "hono";

import HomeController from "views/pages/Home/controller";
import ComponentsController from "views/pages/ComponentsDemo/controller";
import TenetsController from "views/pages/Tenets/controller";
import TenetsApiController from "api/Tenets/controller";
import WellKnownController from "api/WellKnown/controller";
import AuthController from "api/Auth/controller";

import { initDatabase } from "infrastructure/QueryLoader";
import { frameMiddleware } from "infrastructure/frameMiddleware";

import schemaSql from "db/init.sql?raw";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Run DB schema initialization once on first request
let initialized = false;
let initPromise: Promise<void> | null = null;
app.use("*", async (c, next) => {
  if (!initialized) {
    if (!initPromise) {
      initPromise = (async () => {
        const env = c.env as unknown as Record<string, unknown>;
        if (!env.DB) {
          console.error(
            "DB binding is not available. Available keys:",
            Object.keys(env),
          );
          return;
        }
        try {
          await initDatabase(env.DB as D1Database, schemaSql);
          initialized = true;
          console.log("Database initialized");
        } catch (e) {
          console.error("Database init failed:", e);
        }
      })();
    }
    await initPromise;
  }
  await next();
});

// Extract frame depth from query string
app.use("*", frameMiddleware);

HomeController.register(app);
ComponentsController.register(app);
TenetsController.register(app);
TenetsApiController.register(app);
WellKnownController.register(app);
AuthController.register(app);

// Redirect root to /tenets
app.get("/", (c) => c.redirect("/tenets"));

export default app;
```

**Verify:** Run `npm run dev`. Visit `/tenets` — should work as before (depth 0). Visit `/tenets?_depth=1` — should render content inside FrameShell.

**Dependencies:** Task 1.2 (needs `frameMiddleware`).

---

### Task 1.10 — Add layout CSS for iframe sizing

**File:** `src/views/styles/layout.css` (modify — append to existing file)

**What:** Add CSS rules that make the `<main>` element fill the remaining viewport height and make the iframe inside it fill `<main>`. This ensures the iframe takes up all available space below the header nav.

Append to the end of `src/views/styles/layout.css`:

```css
/* ------------------------------------------------------------------ */
/*  Nested Frames: iframe sizing                                       */
/*                                                                     */
/*  At depth 0, the Layout renders an <Outlet /> (iframe) inside       */
/*  <main>. These rules make the iframe fill the available space.     */
/* ------------------------------------------------------------------ */

html, body {
  height: 100%;
  margin: 0;
}

body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  flex-shrink: 0;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Allow flexbox to shrink */
}

main iframe {
  width: 100%;
  flex: 1;
  border: none;
  min-height: 0; /* Allow flexbox to shrink */
}
```

Also create a new file for FrameShell body styling:

**File:** `src/views/pages/Shared/FrameShell.module.css` (new)

```css
/* FrameShell: minimal styles for nested frame bodies */
.shellBody {
  margin: 0;
  padding: var(--pico-block-spacing-vertical) var(--pico-block-spacing-horizontal);
}
```

Update `FrameShell.tsx` to use this class:

```tsx
import styles from "./FrameShell.module.css";

// In the <body> tag:
<body class={styles.shellBody}>
  {children}
</body>
```

**Verify:** Run `npm run dev`. Visit `/tenets`. The iframe inside `<main>` should fill the remaining viewport height below the header nav. The content inside the iframe (at depth 1) should have proper padding.

**Dependencies:** Tasks 1.4, 1.6 (needs FrameShell and Layout with Outlet).

---

### Task 1.11 — End-to-end verification of Phase 1

**What:** Comprehensive manual testing of the depth-aware rendering system.

**Test cases:**

1. **Depth 0 page load:** Visit `/tenets`. Should see:
   - Full Layout with header/nav
   - `<main>` contains an `<iframe>` with `src="/tenets?_depth=1"`
   - The iframe loads and shows the tenets list content (no nav, no Layout chrome)

2. **Depth 1 direct load:** Visit `/tenets?_depth=1`. Should see:
   - FrameShell with just the tenets list content
   - No header/nav
   - `<base target="_self">` in the `<head>`

3. **Navigation within iframe:** Click "Propose" link inside the iframe. Should navigate the iframe to `/tenets/new?_depth=1` (stays inside the frame).

4. **Auth redirect at depth 0:** Without being logged in, visit a protected page. Should redirect to `/auth/login?redirect=...` as before.

5. **Auth redirect at depth > 0:** Without being logged in, visit `/tenets?_depth=1`. Should break out of the iframe and redirect the top-level window to `/auth/login?redirect=...`.

6. **Error at depth 0:** Visit a non-existent page. Should see full Layout with error message.

7. **Error at depth > 0:** Visit `/nonexistent?_depth=1`. Should see error content in FrameShell (no nav).

8. **Form submission:** Submit the "Propose a Tenet" form inside the iframe. Should stay in the iframe and show the result.

9. **Logout form:** The logout form in the Layout (depth 0) should have `target="_top"` added (see note below).

**Important follow-up for Task 1.6:** The logout `<form>` in `Layout.tsx` needs `target="_top"` so it replaces the entire page, not just the iframe. Modify line 78:

```tsx
<form action="/auth/logout" method="post" target="_top">
```

Also, the "Login with GitHub" link should use `target="_top"`:
```tsx
<a href="/auth/login" role="button" target="_top">
  Login with GitHub
</a>
```

**Dependencies:** All Phase 1 tasks.

---

## Phase 2: History & Navigation

Make the browser back/forward buttons work correctly with nested frames. Without this, pressing back after navigating within an iframe would navigate the entire top-level page instead of just the iframe content.

---

### Task 2.1 — Create `frame-router.ts` — top-level history manager

**File:** `src/infrastructure/client/frame-router.ts` (new)

**What:** A script that runs in the top-level frame (depth 0). It listens for `postMessage` events from child iframes announcing navigation, maintains a history stack, and intercepts `popstate` events to route back/forward to the correct iframe.

```ts
// src/infrastructure/client/frame-router.ts

/**
 * Minimal history manager for nested frames.
 *
 * Listens for navigation events from child iframes and keeps
 * the browser address bar in sync. Intercepts back/forward
 * and routes them to the correct iframe.
 *
 * Only runs in the top-level frame (depth 0).
 */

interface HistoryEntry {
  /** The canonical URL path (for address bar) */
  path: string;
  /** Which iframe navigated */
  frameId: string;
  /** The iframe's src at this point */
  frameSrc: string;
}

const historyStack: HistoryEntry[] = [];
let initialized = false;

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

/** Called when a child iframe navigates. */
function onFrameNavigate(event: MessageEvent) {
  if (event.data?.type !== "frame:navigate") return;
  if (event.source === null) return;

  const { path, frameSrc } = event.data;
  const frameId = findFrameId(event.source);
  if (!frameId) return;

  const entry: HistoryEntry = { path, frameId, frameSrc };
  historyStack.push(entry);

  // Update address bar without reload
  history.pushState({ index: historyStack.length - 1 }, "", path);
}

/** Handle browser back/forward. */
function onPopState(_event: PopStateEvent) {
  // The browser has already navigated — update the iframe to match
  const targetPath = location.pathname + location.search;
  const frame = document.querySelector(
    "iframe[name='frame-1']",
  ) as HTMLIFrameElement | null;

  if (frame) {
    // Strip any existing _depth param and add _depth=1
    const url = new URL(targetPath, location.origin);
    url.searchParams.set("_depth", "1");
    frame.src = url.toString();
  }
}

/** Initialize the history manager. Call once at top-level. */
export function initFrameRouter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener("message", onFrameNavigate);
  window.addEventListener("popstate", onPopState);

  // Replace current history entry with our state
  history.replaceState({ index: 0 }, "", location.pathname);
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** None (standalone module).

---

### Task 2.2 — Create `frame-child.ts` — child frame navigation announcer

**File:** `src/infrastructure/client/frame-child.ts` (new)

**What:** A script that runs inside every nested frame (depth > 0). It announces navigation to the parent frame via `postMessage` so the address bar stays in sync.

```ts
// src/infrastructure/client/frame-child.ts

/**
 * Minimal script injected into every nested frame.
 * Announces navigation to the parent frame so the address bar stays in sync.
 *
 * Only runs in nested frames (depth > 0).
 */

/** Strip _depth from the URL before announcing to parent. */
function announce(): void {
  const url = new URL(location.href);
  url.searchParams.delete("_depth");

  parent.postMessage(
    {
      type: "frame:navigate",
      path: url.pathname + url.search,
      frameSrc: location.href,
    },
    "*", // TODO: restrict origin in production
  );
}

// Announce on initial load
announce();

// Announce on navigation (links, form submissions cause full page loads,
// so we announce on each load. For JS-driven navigations, patch history.)
const origPush = history.pushState;
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  origPush.apply(this, args);
  announce();
};

const origReplace = history.replaceState;
history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
  origReplace.apply(this, args);
  announce();
};
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** None (standalone module).

---

### Task 2.3 — Modify `FrameShell.tsx` — include child script and `<base target="_self">`

**File:** `src/views/pages/Shared/FrameShell.tsx` (modify)

**What:** Add the `frame-child.ts` script to FrameShell so every nested frame announces navigation to the parent. The `<base target="_self">` is already there from Task 1.4.

The FrameShell should include the child script. Since this is a server-rendered app and we need the script to run in production, we'll inline a small script or reference it as a module.

**Updated FrameShell:**

```tsx
// src/views/pages/Shared/FrameShell.tsx

import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./FrameShell.module.css";

interface FrameShellProps extends PropsWithChildren {
  depth: number;
}

/**
 * Minimal HTML shell for nested frames.
 * Includes CSS, client JS, and the frame-child navigation announcer.
 * No global navigation — that's only in the Layout at depth 0.
 */
export const FrameShell: FC<FrameShellProps> = ({ children, depth }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      {/* Links/forms default to staying in this frame */}
      <base target="_self" />
      <link rel="stylesheet" href="/.generated/styles/index.css" />
      {import.meta.env.DEV ? (
        <>
          <script type="module" src="/@vite/client"></script>
          <script type="module" src="/src/infrastructure/client/main.ts"></script>
        </>
      ) : (
        <script type="module" src="/.generated/client/main.js"></script>
      )}
      {/* Announce navigation to parent frame for history management */}
      {import.meta.env.DEV ? (
        <script type="module" src="/src/infrastructure/client/frame-child.ts"></script>
      ) : (
        <script type="module" src="/.generated/client/frame-child.js"></script>
      )}
    </head>
    <body class={styles.shellBody}>
      {children}
    </body>
  </html>
);
```

**Note on production build:** The `frame-child.ts` script needs to be included in the Vite build. Since it's a separate entry point, we need to either:
- **Option A (recommended):** Import it from `main.ts` conditionally based on depth, so it's bundled with the main client bundle.
- **Option B:** Add it as a separate Vite entry point.

For simplicity, we'll go with **Option A** — see Task 2.5.

**Verify:** Visit `/tenets?_depth=1`. Check that the FrameShell HTML includes `<base target="_self">` and the frame-child script tag.

**Dependencies:** Tasks 1.4, 2.2.

---

### Task 2.4 — Modify `Layout.tsx` — include frame-router script (top-level only)

**File:** `src/views/pages/Shared/Layout.tsx` (modify)

**What:** Add the `frame-router` script to the Layout so it initializes in the top-level frame. This script only runs at depth 0.

Add the frame-router script to the `<head>` section, after the existing scripts:

```tsx
{/* Frame history manager — only runs at depth 0 */}
{import.meta.env.DEV ? (
  <script type="module" src="/src/infrastructure/client/frame-router.ts"></script>
) : (
  <script type="module" src="/.generated/client/frame-router.js"></script>
)}
```

**Note:** Like frame-child, this needs to be part of the build. See Task 2.5 for the bundling approach.

**Verify:** Visit `/tenets` at depth 0. Check that the Layout HTML includes the frame-router script tag.

**Dependencies:** Task 2.1.

---

### Task 2.5 — Modify `main.ts` — conditional init based on depth

**File:** `src/infrastructure/client/main.ts` (modify)

**What:** Import the frame-child script so it gets bundled with the main client JS. The frame-router is a separate concern that initializes itself.

The approach: Instead of separate script tags for frame-child and frame-router, we'll import frame-child from main.ts and have it self-initialize. The frame-router will also be imported and self-initialize only at depth 0.

**Updated `main.ts`:**

```ts
/**
 * Client-side entry point for js-mvc.
 * Compiled to public/.generated/client/main.js and loaded by the server-rendered layout.
 */

// Import each handler to trigger its side-effect registration with the dispatcher
import "../../views/handlers/DismissHandler";
import "../../views/handlers/ConfirmHandler";
import "../../views/handlers/VoteHandler";
import "../../views/handlers/StatusTransitionHandler";
import "../../views/handlers/AddOptionHandler";
import { start } from "./dispatcher";

// Frame navigation scripts
import "./frame-child";
import "./frame-router";

console.log("js-mvc client loaded");

/** Waits for the DOM to be ready, then runs the callback */
export function onReady(cb: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb);
  } else {
    cb();
  }
}

// --- Bootstrap ---
start();
```

Now update `frame-child.ts` to self-initialize on import (it already does — the `announce()` call and history patching run at module level).

Update `frame-router.ts` to also self-initialize on import, but only at depth 0:

```ts
// Add to the bottom of frame-router.ts, after initFrameRouter():

// Auto-initialize at depth 0 (top-level frame)
// At depth > 0, this script is still loaded but shouldn't initialize
if (typeof window !== "undefined" && !window.frameElement) {
  // window.frameElement is null in top-level frames
  initFrameRouter();
}
```

Wait — this check isn't reliable because `window.frameElement` might be null even in iframes in some browsers. Better approach: check for the `_depth` query param in the URL.

```ts
// Auto-initialize at depth 0 only
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (!params.has("_depth")) {
    initFrameRouter();
  }
}
```

And for `frame-child.ts`, only announce at depth > 0:

```ts
// Auto-initialize at depth > 0 only
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (params.has("_depth")) {
    announce();
  }
}
```

**Updated `frame-child.ts` (full):**

```ts
// src/infrastructure/client/frame-child.ts

/**
 * Minimal script injected into every nested frame.
 * Announces navigation to the parent frame so the address bar stays in sync.
 * Only runs in nested frames (depth > 0).
 */

/** Strip _depth from the URL before announcing to parent. */
function announce(): void {
  const url = new URL(location.href);
  url.searchParams.delete("_depth");

  parent.postMessage(
    {
      type: "frame:navigate",
      path: url.pathname + url.search,
      frameSrc: location.href,
    },
    "*", // TODO: restrict origin in production
  );
}

// Patch history methods to catch JS-driven navigations
const origPush = history.pushState;
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  origPush.apply(this, args);
  announce();
};

const origReplace = history.replaceState;
history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
  origReplace.apply(this, args);
  announce();
};

// Auto-initialize at depth > 0 only
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (params.has("_depth")) {
    announce();
  }
}
```

**Updated `frame-router.ts` (add to bottom):**

```ts
// Auto-initialize at depth 0 only (top-level frame)
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (!params.has("_depth")) {
    initFrameRouter();
  }
}
```

Now remove the separate script tags from `FrameShell.tsx` and `Layout.tsx` since both scripts are bundled into `main.js` via the import in `main.ts`.

**Revert the script additions from Tasks 2.3 and 2.4.** The frame-child and frame-router scripts are now imported by `main.ts` and included in the main client bundle. No separate script tags needed.

**Verify:** Run `npm run dev`. Visit `/tenets`. Open browser DevTools console. You should see:
- At depth 0: "js-mvc client loaded" and frame-router initialized
- At depth 1 (inside the iframe): "js-mvc client loaded" and a `postMessage` sent to parent

Navigate within the iframe (click a tenet). The address bar should update via `pushState`. Press browser back — the iframe should navigate back.

**Dependencies:** Tasks 2.1, 2.2, 2.3, 2.4.

---

### Task 2.6 — Test back/forward navigation

**What:** Manual testing of history management.

**Test cases:**

1. **Basic navigation:** Visit `/tenets` (depth 0). The iframe loads `/tenets?_depth=1`. Click a tenet link inside the iframe. The address bar should update to `/tenets/some-slug`. Press browser back — the iframe should navigate back to `/tenets?_depth=1`.

2. **Deep link:** Visit `/tenets/some-slug` directly. The top-level page loads, the iframe loads `/tenets/some-slug?_depth=1`. The address bar should show `/tenets/some-slug`.

3. **Multiple navigations:** Navigate within the iframe several times. Press back multiple times — each press should navigate the iframe back one step.

4. **Form submission:** Submit the "Propose a Tenet" form inside the iframe. After redirect, the address bar should update. Press back — should go back to the form.

5. **Auth redirect:** If not logged in, visit a protected page. The redirect should break out of the iframe (from Task 1.7).

**Dependencies:** All Phase 2 tasks.

---

## Phase 3: iframe Sizing

Make iframes fill their containers properly. Phase 1's CSS already handles the basic flexbox layout. This phase adds dynamic height reporting for variable-height content.

---

### Task 3.1 — Layout CSS for flexbox viewport fill

**File:** `src/views/styles/layout.css` (modify — already done in Task 1.10)

**What:** The CSS from Task 1.10 already handles the basic flexbox layout. Verify it works correctly.

**Verify:** Visit `/tenets`. The iframe should fill the viewport below the header. Resize the browser window — the iframe should resize accordingly.

**Dependencies:** Task 1.10.

---

### Task 3.2 — FrameShell height reporting via ResizeObserver + postMessage

**File:** `src/infrastructure/client/frame-child.ts` (modify)

**What:** Add a `ResizeObserver` that watches the document body height and reports it to the parent frame via `postMessage`. This allows the parent to set the iframe height to match its content.

Add to `frame-child.ts`, after the `announce()` function:

```ts
/** Report content height to parent for dynamic iframe sizing. */
function reportHeight(): void {
  const height = document.documentElement.scrollHeight;
  parent.postMessage(
    {
      type: "frame:resize",
      height,
    },
    "*", // TODO: restrict origin in production
  );
}

// Observe content height changes and report to parent
function initHeightReporting(): void {
  // Initial report
  reportHeight();

  // Observe body size changes
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
  }
}
```

Call `initHeightReporting()` in the auto-initialization block:

```ts
// Auto-initialize at depth > 0 only
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (params.has("_depth")) {
    announce();
    initHeightReporting();
  }
}
```

**Verify:** Visit `/tenets?_depth=1`. Open DevTools console. You should see `postMessage` events being sent with `type: "frame:resize"` and a `height` value.

**Dependencies:** Task 2.2.

---

### Task 3.3 — frame-router height listener

**File:** `src/infrastructure/client/frame-router.ts` (modify)

**What:** Add a listener for `frame:resize` messages that adjusts the iframe height.

Add to `frame-router.ts`, after the `onFrameNavigate` function:

```ts
/** Listen for height reports from child frames and adjust iframe height. */
function onFrameResize(event: MessageEvent): void {
  if (event.data?.type !== "frame:resize") return;
  const frameId = findFrameId(event.source);
  if (!frameId) return;

  const iframe = document.querySelector(
    `iframe[name="${frameId}"]`,
  ) as HTMLIFrameElement | null;
  if (iframe) {
    iframe.style.height = event.data.height + "px";
  }
}
```

Register the listener in `initFrameRouter()`:

```ts
export function initFrameRouter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener("message", onFrameNavigate);
  window.addEventListener("message", onFrameResize); // ADD THIS
  window.addEventListener("popstate", onPopState);

  history.replaceState({ index: 0 }, "", location.pathname);
}
```

**Verify:** Visit `/tenets`. The iframe inside `<main>` should resize to match its content height. If the content changes (e.g., adding items), the iframe should resize accordingly.

**Dependencies:** Tasks 2.1, 3.2.

---

### Task 3.4 — Test sizing

**What:** Manual testing of iframe sizing.

**Test cases:**

1. **Viewport fill:** Visit `/tenets`. The iframe should fill the viewport below the header. No scrollbars on the outer page — only inside the iframe.

2. **Dynamic content:** Navigate to a tenet detail page inside the iframe. The iframe should resize to fit the content.

3. **Resize:** Resize the browser window. The iframe should resize accordingly.

4. **Long content:** View a tenet with lots of content. The iframe should expand to show all content without clipping.

**Dependencies:** Tasks 3.1, 3.2, 3.3.

---

## Phase 4: Multi-Outlet (Stretch Goal)

Enable section views with multiple Outlets (e.g., sidebar + detail). This is a stretch goal and should only be attempted after Phases 1–3 are stable.

---

### Task 4.1 — Named outlets in Outlet component

**File:** `src/views/components/Outlet/index.tsx` (modify)

**What:** Add a `name` prop to `<Outlet />` that becomes the `name` attribute on the iframe. This allows the frame-router to target specific iframes.

```tsx
interface OutletProps {
  /** Path for this outlet. Defaults to the current request path. */
  path?: string;
  /** Named outlet — becomes the iframe name attribute. */
  name?: string;
}

export const Outlet: FC<OutletProps> = ({ path, name }) => {
  const outletPath = path ?? getFramePath();
  const outletDepth = getFrameDepth() + 1;

  const src = outletPath.includes("?")
    ? `${outletPath}&_depth=${outletDepth}`
    : `${outletPath}?_depth=${outletDepth}`;

  const frameName = name ?? `frame-${outletDepth}`;

  return (
    <iframe
      name={frameName}
      src={src}
      style="width:100%;height:100%;border:none;"
      title={path ? `Frame: ${path}` : `Frame depth ${outletDepth}`}
    />
  );
};
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Task 1.3.

---

### Task 4.2 — Section view for Tenets (sidebar + detail)

**File:** `src/views/pages/Tenets/views/section.tsx` (new)

**What:** A section shell view with two Outlets: a sidebar (tenet list) and a detail pane (selected tenet).

```tsx
// src/views/pages/Tenets/views/section.tsx

import type { FC } from "hono/jsx";
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
      <Outlet path="/tenets" name="sidebar" />
    </aside>
    <div class={styles.detailPane}>
      <Outlet path="/tenets/:slug" name="detail" />
    </div>
  </div>
);
```

**File:** `src/views/pages/Tenets/views/section.module.css` (new)

```css
.tenetsLayout {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100vh;
  overflow: hidden;
}

.tenetsLayout aside {
  overflow-y: auto;
  border-right: 1px solid var(--pico-muted-border-color);
}

.detailPane {
  overflow-y: auto;
  padding: var(--pico-block-spacing-vertical) var(--pico-block-spacing-horizontal);
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Task 4.1.

---

### Task 4.3 — Inter-frame communication via postMessage

**File:** `src/infrastructure/client/frame-router.ts` (modify)

**What:** Add support for `frame:outlet` messages that allow a child iframe to navigate a sibling iframe. When the sidebar sends a `frame:outlet` message, the parent updates the target iframe's `src`.

Add to `frame-router.ts`:

```ts
/** Handle outlet navigation — a child frame requests a sibling to navigate. */
function onOutletNavigate(event: MessageEvent): void {
  if (event.data?.type !== "frame:outlet") return;
  const { outlet, path } = event.data;
  if (!outlet || !path) return;

  const iframe = document.querySelector(
    `iframe[name="${outlet}"]`,
  ) as HTMLIFrameElement | null;
  if (!iframe) return;

  // Build the URL with appropriate depth
  const url = new URL(path, location.origin);
  const currentDepth = parseInt(
    new URL(iframe.src).searchParams.get("_depth") || "1",
    10,
  );
  url.searchParams.set("_depth", String(currentDepth));
  iframe.src = url.toString();

  // Update address bar to reflect the primary content
  history.pushState({ index: historyStack.length }, "", path);
}
```

Register in `initFrameRouter()`:

```ts
window.addEventListener("message", onOutletNavigate);
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Task 2.1.

---

### Task 4.4 — Controller changes for section routes

**File:** `src/views/pages/Tenets/controller.tsx` (modify)

**What:** Add a route that renders the section view at depth 1. This is complex because the section view needs to know which tenet to show in the detail pane.

**Note:** This is a stretch goal and requires careful design. The simplest approach is:

1. At depth 0, the tenets index route renders Layout with Outlet → `/tenets?_depth=1`
2. At depth 1, the tenets index route renders the section view (sidebar + detail)
3. The detail pane's Outlet path is determined by the URL (e.g., `/tenets/:slug`)

This requires the controller to check `frameDepth` and render different views:

```tsx
@Get("/")
async index(c: Context) {
  const depth = c.get("frameDepth") ?? 0;
  const user = c.get("user") as unknown as UserRow;
  const result = await tenetService.list((c.env as CloudflareBindings).DB);

  if (depth === 1) {
    // Section view with sidebar + detail outlets
    return c.render(<SectionView />);
  }

  // Depth 0: Layout renders Outlet → depth 1
  // Depth 2+: Just the list (leaf content)
  return c.render(<IndexView {...viewBuilder.index(result.tenets, user)} />);
}
```

**This is a significant change and should only be attempted after Phases 1–3 are thoroughly tested.**

**Dependencies:** Tasks 4.1, 4.2, 4.3.

---

### Task 4.5 — Test multi-outlet navigation

**What:** Manual testing of the sidebar + detail pattern.

**Test cases:**

1. **Section view loads:** Visit `/tenets`. Should see sidebar with tenet list and detail pane.

2. **Click tenet in sidebar:** Should update the detail pane iframe without reloading the sidebar.

3. **Address bar updates:** The address bar should update to `/tenets/some-slug` when a tenet is selected.

4. **Back button:** Pressing back should navigate the detail pane back.

5. **Deep link:** Visit `/tenets/some-slug` directly. Should load the section view with that tenet in the detail pane.

**Dependencies:** Tasks 4.1–4.4.

---

## Summary: File Changes by Phase

### Phase 1 — New Files
| File | Purpose |
|---|---|
| `src/infrastructure/FrameContext.ts` | Module-level frame context (depth + path) |
| `src/infrastructure/frameMiddleware.ts` | Hono middleware to extract `_depth` from query |
| `src/views/components/Outlet/index.tsx` | `<Outlet />` component (renders as `<iframe>`) |
| `src/views/pages/Shared/FrameShell.tsx` | Minimal HTML shell for nested frames |
| `src/views/pages/Shared/FrameShell.module.css` | FrameShell body styles |

### Phase 1 — Modified Files
| File | Change |
|---|---|
| `src/infrastructure/ControllerBase.tsx` | Depth-aware renderer (Layout at depth 0, FrameShell at depth 1+) |
| `src/views/pages/Shared/Layout.tsx` | Add `depth` prop, render `<Outlet />` at depth 0 |
| `src/middlewares/auth.tsx` | `frameRedirect()` helper for depth-aware auth redirects |
| `src/infrastructure/errors/index.tsx` | Depth-aware error rendering (FrameShell at depth > 0) |
| `src/views/pages/Shared/Results.tsx` | Add `depth` prop, skip Layout wrapper at depth > 0 |
| `src/index.tsx` | Register `frameMiddleware` |
| `src/views/styles/layout.css` | Flexbox rules for iframe sizing |

### Phase 2 — New Files
| File | Purpose |
|---|---|
| `src/infrastructure/client/frame-router.ts` | Top-level history manager |
| `src/infrastructure/client/frame-child.ts` | Child frame navigation announcer |

### Phase 2 — Modified Files
| File | Change |
|---|---|
| `src/infrastructure/client/main.ts` | Import frame-router and frame-child |
| `src/views/pages/Shared/Layout.tsx` | (Script tag removed — bundled via main.ts) |
| `src/views/pages/Shared/FrameShell.tsx` | (Script tag removed — bundled via main.ts) |

### Phase 3 — Modified Files
| File | Change |
|---|---|
| `src/infrastructure/client/frame-child.ts` | Add ResizeObserver height reporting |
| `src/infrastructure/client/frame-router.ts` | Add `frame:resize` message listener |

### Phase 4 — New Files
| File | Purpose |
|---|---|
| `src/views/pages/Tenets/views/section.tsx` | Section view with two Outlets |
| `src/views/pages/Tenets/views/section.module.css` | Grid layout for sidebar + detail |

### Phase 4 — Modified Files
| File | Change |
|---|---|
| `src/views/components/Outlet/index.tsx` | Add `name` prop for named outlets |
| `src/infrastructure/client/frame-router.ts` | Add `frame:outlet` message handler |
| `src/views/pages/Tenets/controller.tsx` | Add section route at depth 1 |

---

## Implementation Order

```
Phase 1 (Foundation — must be first):
  1.1 FrameContext.ts          ← no deps
  1.2 frameMiddleware.ts       ← depends on 1.1
  1.3 Outlet component         ← depends on 1.1
  1.4 FrameShell component     ← no deps
  1.5 ControllerBase.tsx       ← depends on 1.2, 1.4
  1.6 Layout.tsx               ← depends on 1.3, 1.5
  1.7 auth.tsx                 ← depends on 1.1
  1.8 handleError + Results   ← depends on 1.1, 1.4
  1.9 index.tsx                ← depends on 1.2
  1.10 layout CSS              ← depends on 1.6
  1.11 E2E verification        ← depends on all above

Phase 2 (History — depends on Phase 1):
  2.1 frame-router.ts          ← no deps
  2.2 frame-child.ts           ← no deps
  2.3 FrameShell.tsx update    ← depends on 1.4, 2.2
  2.4 Layout.tsx update        ← depends on 2.1
  2.5 main.ts update           ← depends on 2.1, 2.2
  2.6 Test back/forward        ← depends on all above

Phase 3 (Sizing — depends on Phase 2):
  3.1 Verify layout CSS        ← depends on 1.10
  3.2 frame-child height       ← depends on 2.2
  3.3 frame-router height      ← depends on 2.1, 3.2
  3.4 Test sizing              ← depends on all above

Phase 4 (Multi-Outlet — stretch, depends on Phase 3):
  4.1 Named outlets            ← depends on 1.3
  4.2 Section view             ← depends on 4.1
  4.3 Inter-frame comms        ← depends on 2.1
  4.4 Controller changes       ← depends on 4.1–4.3
  4.5 Test multi-outlet        ← depends on all above
```

---

## Key Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Back button edge cases | High | Thorough manual testing in Phase 2.6; consider automated Playwright tests |
| iframe height flickering | Medium | Use `overflow: hidden` on parent during resize; debounce ResizeObserver |
| Module-level state in Workers | Low | Cloudflare Workers run one request per isolate — safe for concurrent requests |
| Vite HMR with iframes | Low | Each iframe establishes its own WebSocket — works but N connections for N frames |
| `postMessage` origin validation | Low | Restrict to app origin in production; use `*` only in dev |
| CSS isolation across frames | Low | Pico CSS is small (~10KB); each frame parses independently but caches |