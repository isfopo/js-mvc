# Nested Frames — Step-by-Step Implementation Plan

This plan translates the design in `NESTED_FRAMES.md` into concrete, ordered tasks. Each task specifies exact files, code changes, verification steps, and dependencies.

> **Status Legend:** ✅ Complete · 🔲 Pending · ⚡ In Progress

---

## Phase 1: Depth-Aware Rendering (Foundation) — ✅ COMPLETE

The core change: the server renders different HTML depending on the `_depth` query parameter. At depth 0, the full `Layout` wraps content in an `<Outlet />` (which becomes an `<iframe>`). At depth 1+, `FrameShell` wraps content with no global nav.

---

### Task 1.1 — Create `FrameContext.ts` ✅

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

### Task 1.2 — Create `frameMiddleware.ts` ✅

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

### Task 1.3 — Create the `Outlet` component ✅

**File:** `src/views/components/Outlet/index.tsx` (new)

> **⚠️ Bug fix applied:** An obsolete `Outlet.tsx` file was shadowing `Outlet/index.tsx`. The old file used `window.location.pathname` which doesn't work server-side. The obsolete file was deleted.

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

### Task 1.4 — Create the `FrameShell` component ✅

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

### Task 1.5 — Modify `ControllerBase.tsx` — depth-aware renderer ✅

**File:** `src/infrastructure/ControllerBase.tsx` (modify)

> **⚠️ Bug fix applied:** Changed from `c.get("frameDepth")` to `getFrameDepth()` from `FrameContext`. Hono sub-apps get a fresh context, so context variables (`c.set`/`c.get`) don't carry over when a controller is mounted as a sub-app. The module-level `getFrameDepth()` works reliably across sub-app boundaries.

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

### Task 1.6 — Modify `Layout.tsx` — render Outlet at depth 0 ✅

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

### Task 1.7 — Modify `auth.tsx` — depth-aware redirects ✅

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

### Task 1.8 — Modify `handleError` — depth-aware error rendering ✅

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

### Task 1.9 — Modify `index.tsx` — register frame middleware ✅

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

### Task 1.10 — Add layout CSS for iframe sizing ✅

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

### Task 1.11 — End-to-end verification of Phase 1 ✅

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

## Phase 2: History & Navigation — ⚡ IN PROGRESS

Make the browser back/forward buttons work correctly with nested frames. Without this, pressing back after navigating within an iframe would navigate the entire top-level page instead of just the iframe content.

---

### Task 2.1 — Create `frame-router.ts` — top-level history manager ✅

**File:** `src/infrastructure/client/frame-router.ts` (new)

> **Implementation note:** `frame-router.ts` also includes `frame:resize` message handling (originally planned as Phase 3 Task 3.3). This Phase 3 feature was pulled forward because it's a natural fit alongside the `postMessage` infrastructure.

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

### Task 2.2 — Create `frame-child.ts` — child frame navigation announcer ✅

**File:** `src/infrastructure/client/frame-child.ts` (new)

> **Implementation note:** `frame-child.ts` was enhanced beyond the original plan. In addition to announcing navigation via `postMessage`, it now **intercepts link clicks and form submissions** to automatically append `_depth=N` to URLs. This means templates don't need manual URL rewriting — the client script handles it transparently.

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

### Task 2.3 — Modify `FrameShell.tsx` — include child script and `<base target="_self">` ✅

**File:** `src/views/pages/Shared/FrameShell.tsx` (modify)

> **Implementation note:** No separate `<script>` tag was added to FrameShell. Both `frame-child.ts` and `frame-router.ts` are imported from `main.ts` and bundled into the main client JS. The `<base target="_self">` was already included in Task 1.4. This task is effectively complete without the separate script tag approach described in the original plan.

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

### Task 2.4 — Modify `Layout.tsx` — include frame-router script (top-level only) ✅

**File:** `src/views/pages/Shared/Layout.tsx` (modify)

> **Implementation note:** No separate `<script>` tag was added to Layout. Both `frame-child.ts` and `frame-router.ts` are imported from `main.ts` and bundled into the main client JS. The scripts self-activate based on the presence/absence of `_depth` in the URL, so no conditional script loading in the template is needed.

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

### Task 2.5 — Modify `main.ts` — conditional init based on depth ✅

**File:** `src/infrastructure/client/main.ts` (modify)

> **Implementation note:** Both `frame-child` and `frame-router` are imported from `main.ts` and bundled into the single client JS bundle. They self-activate based on `_depth`:
> - `frame-child.ts` only activates when `_depth` is present in the URL (depth > 0)
> - `frame-router.ts` only activates when `_depth` is absent (depth 0 / top-level frame)
>
> This eliminates the need for separate script tags in FrameShell or Layout.

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

### Task 2.6 — Test back/forward navigation 🔲

**What:** Manual testing of history management.

> **Status:** Pending manual testing.

**Test cases:**

1. **Basic navigation:** Visit `/tenets` (depth 0). The iframe loads `/tenets?_depth=1`. Click a tenet link inside the iframe. The address bar should update to `/tenets/some-slug`. Press browser back — the iframe should navigate back to `/tenets?_depth=1`.

2. **Deep link:** Visit `/tenets/some-slug` directly. The top-level page loads, the iframe loads `/tenets/some-slug?_depth=1`. The address bar should show `/tenets/some-slug`.

3. **Multiple navigations:** Navigate within the iframe several times. Press back multiple times — each press should navigate the iframe back one step.

4. **Form submission:** Submit the "Propose a Tenet" form inside the iframe. After redirect, the address bar should update. Press back — should go back to the form.

5. **Auth redirect:** If not logged in, visit a protected page. The redirect should break out of the iframe (from Task 1.7).

**Dependencies:** All Phase 2 tasks.

---

## Phase 3: Preload Hints — 🔲 NOT STARTED

Add `<link rel="preload">` and `<link rel="modulepreload">` hints to `Layout.tsx` so CSS/JS are cached before the iframe needs them. Zero architecture changes — free performance win.

---

### Task 3.1 — Add preload hints to Layout.tsx 🔲

**File:** `src/views/pages/Shared/Layout.tsx` (modify)

**What:** Add preload hints to the `<head>` section so the browser caches CSS and JS before the iframe requests them.

In the `<head>` section of Layout, add before the existing stylesheet and script tags:

```tsx
{/* Preload resources that nested frames will also need */}
<link rel="preload" href="/.generated/styles/index.css" as="style" />
{import.meta.env.PROD && (
  <link rel="modulepreload" href="/.generated/client/main.js" />
)}
```

The `modulepreload` hint is production-only because Vite handles module loading in dev mode via its own HMR infrastructure.

**Verify:** Run `npm run build && npm run preview`. Open DevTools Network tab on a depth-0 page. Both `index.css` and `main.js` should appear with `initiator: <link>` (preloaded) before the iframe's request for the same resources. In dev mode, only the CSS preload hint should appear.

**Dependencies:** Phase 1 (needs Layout.tsx with Outlet).

---

### Task 3.2 — Test preload timing 🔲

**What:** Verify that preloaded resources are served from cache when the iframe requests them.

**Test cases:**

1. **CSS cache hit:** Open DevTools Network tab on `/tenets`. Verify `index.css` at depth 1 has `from cache` or `from disk cache` in the size column, not a fresh network request.

2. **JS cache hit:** Same for `main.js` in production mode — should be served from cache.

3. **Dev mode:** In dev mode, verify the `modulepreload` hint is absent (Vite handles this) and CSS is still preloaded.

4. **No double-fetch:** Confirm only one request per resource. Preload should not cause duplicate fetches.

**Dependencies:** Task 3.1.

---

## Phase 4: adoptedStyleSheets Sharing — 🔲 NOT STARTED

Share `CSSStyleSheet` objects from parent to child frames using `document.adoptedStyleSheets`, avoiding CSSOM re-parsing on each iframe navigation. Modern browsers only (Chrome 73+, Firefox 101+, Safari 16.4+). Keep `<link>` in FrameShell as fallback.

---

### Task 4.1 — Create `frame-styles.ts` — parent-side style orchestrator 🔲

**File:** `src/infrastructure/client/frame-styles.ts` (new)

**What:** A parent-side module that fetches the CSS file, constructs a `CSSStyleSheet`, and sends the text to child iframes via `postMessage` with type `frame:styles`.

```ts
// src/infrastructure/client/frame-styles.ts

/**
 * Parent-side style sharing module.
 * Fetches the CSS file and sends its text to child iframes
 * so they can apply it via adoptedStyleSheets instead of
 * re-requesting and re-parsing the stylesheet.
 */

const CSS_PATH = "/.generated/styles/index.css";

/** Fetch the CSS file and return its text. */
async function fetchCssText(): Promise<string> {
  const response = await fetch(CSS_PATH);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSS: ${response.status}`);
  }
  return response.text();
}

/** Send CSS text to a child iframe via postMessage. */
function sendStylesToFrame(iframe: HTMLIFrameElement, cssText: string): void {
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: "frame:styles", cssText },
      "*", // TODO: restrict origin in production
    );
  }
}

/** Fetch and share styles with the given iframe. */
export async function shareStylesWithFrame(
  iframe: HTMLIFrameElement,
): Promise<void> {
  try {
    const cssText = await fetchCssText();
    sendStylesToFrame(iframe, cssText);
  } catch (e) {
    console.warn("[frame-styles] Failed to share styles:", e);
    // Fallback: the iframe's <link> tag will fetch CSS normally
  }
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** None.

---

### Task 4.2 — Modify `frame-router.ts` — send styles to child iframe 🔲

**File:** `src/infrastructure/client/frame-router.ts` (modify)

**What:** After the child iframe announces navigation (`frame:navigate`), the parent sends it the CSS text via `frame:styles`. Also send styles when the iframe first loads.

Add import:

```ts
import { shareStylesWithFrame } from "./frame-styles";
```

Modify `onFrameNavigate` to send styles after the iframe navigates:

```ts
function onFrameNavigate(event: MessageEvent) {
  // ... existing logic ...

  // Send shared styles to the iframe after navigation
  const iframe = document.querySelector(
    `iframe[name="${frameId}"]`,
  ) as HTMLIFrameElement | null;
  if (iframe) {
    shareStylesWithFrame(iframe);
  }
}
```

Also add an iframe load listener in `initFrameRouter()`:

```ts
// Listen for iframe loads to share styles
document.querySelectorAll("iframe").forEach((iframe) => {
  iframe.addEventListener("load", () => {
    shareStylesWithFrame(iframe as HTMLIFrameElement);
  });
});
```

**Verify:** Visit `/tenets`. Check DevTools Network tab — the iframe should not make a separate CSS request if `adoptedStyleSheets` is supported.

**Dependencies:** Task 4.1.

---

### Task 4.3 — Modify `frame-child.ts` — listen for `frame:styles` and apply via `adoptedStyleSheets` 🔲

**File:** `src/infrastructure/client/frame-child.ts` (modify)

**What:** Listen for `frame:styles` messages, construct a `CSSStyleSheet` from the received text, and apply via `document.adoptedStyleSheets`. Remove the `<link>` tag if present (it's now redundant).

Add a listener function:

```ts
/** Whether shared styles have been applied via adoptedStyleSheets. */
declare global {
  interface Window {
    __frameStylesShared?: boolean;
  }
}

/** Listen for shared styles from the parent frame. */
function listenForSharedStyles(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "frame:styles") return;
    if (event.source !== parent) return;

    const { cssText } = event.data as { cssText: string };

    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        sheet,
      ];
      // Mark that styles were shared so FrameShell can skip <link>
      window.__frameStylesShared = true;

      // Remove the <link> stylesheet if present (it's now redundant)
      const link = document.querySelector(
        'link[rel="stylesheet"][href*="index.css"]',
      );
      if (link) link.remove();
    } catch (e) {
      console.warn("[frame-child] Failed to apply shared styles:", e);
      // Fallback: the <link> tag in FrameShell still works
    }
  });
}
```

Call `listenForSharedStyles()` in the auto-initialization block alongside `announce()`, `initHeightReporting()`, etc.

**Verify:** Visit `/tenets?_depth=1` in Chrome 73+ or Firefox 101+. Check DevTools:
- The `index.css` `<link>` tag should be removed from the iframe's `<head>`.
- `document.adoptedStyleSheets` should contain the shared stylesheet.
- The page styles should render correctly.

In an older browser (or if JS fails), the `<link>` tag should remain as fallback.

**Dependencies:** Task 4.1.

---

### Task 4.4 — Test style sharing 🔲

**What:** Verify style sharing works correctly and falls back gracefully.

**Test cases:**

1. **Modern browser (Chrome/Firefox/Safari):** Visit `/tenets`. In the iframe's Network tab, `index.css` should show as cached (no separate request from the iframe). Styles should render correctly.

2. **Fallback:** If `adoptedStyleSheets` fails or isn't supported, the `<link>` tag should remain and CSS loads normally.

3. **Navigation:** Navigate within the iframe. Styles should persist (no flash of unstyled content).

4. **Re-send on reload:** Reload the iframe. The parent should re-send `frame:styles`.

**Dependencies:** Tasks 4.1–4.3.

---

## Phase 5: Fetch + DOM Swap — 🔲 NOT STARTED

Instead of navigating iframes via URL (which reloads CSS/JS), the parent `fetch()`es the new page HTML, extracts the `<body>` content, and sends it to the child iframe via `postMessage`. The child swaps `document.body.innerHTML` and re-initializes handlers. This achieves near-instant SPA-like navigation within the frame.

> ⚠️ **Incompatible with original multi-iframe design.** Phase 7 (Multi-Outlet) is redesigned to use a single iframe with fetch+swap for content updates, instead of multiple iframes.

---

### Task 5.1 — Create `frame-navigator.ts` — parent-side fetch orchestrator 🔲

**File:** `src/infrastructure/client/frame-navigator.ts` (new)

**What:** Parent-side module that fetches page HTML, extracts `<body>`, and sends it to the child iframe via `postMessage` with type `frame:swap`.

```ts
// src/infrastructure/client/frame-navigator.ts

/**
 * Parent-side navigation orchestrator.
 * Fetches page HTML, extracts <body> content, and sends it
 * to the child iframe for DOM swapping instead of full navigation.
 */

let activeFetch: AbortController | null = null;

const parser = new DOMParser();

/** Fetch a page, extract <body> content, and send to child iframe. */
export async function fetchAndSwap(
  url: string,
  iframe: HTMLIFrameElement,
): Promise<void> {
  if (activeFetch) {
    activeFetch.abort();
  }
  activeFetch = new AbortController();

  try {
    // Add _depth=1 so the server renders FrameShell (not Layout)
    const fetchUrl = new URL(url, location.origin);
    fetchUrl.searchParams.set("_depth", "1");

    const response = await fetch(fetchUrl.toString(), {
      signal: activeFetch.signal,
      credentials: "same-origin",
      headers: { "X-Requested-With": "frame-swap" },
    });

    // Accept 4xx responses (error pages are valid swap targets)
    if (!response.ok && response.status >= 500) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const doc = parser.parseFromString(html, "text/html");

    const bodyHtml = doc.body.innerHTML;
    const title = doc.title;

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: "frame:swap",
          bodyHtml,
          title,
          url, // original URL (without _depth)
          statusCode: response.status,
        },
        "*",
      );
    }

    // Update address bar
    history.pushState({ index: -1 }, "", url);

    activeFetch = null;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;

    console.warn("[frame-navigator] Fetch failed, falling back to navigation:", e);
    // Fallback: navigate the iframe directly
    iframe.src = url.includes("?")
      ? `${url}&_depth=1`
      : `${url}?_depth=1`;
    activeFetch = null;
  }
}

/** Handle back/forward by fetching and swapping content. */
export async function fetchAndSwapForPopState(
  url: string,
  iframe: HTMLIFrameElement,
): Promise<void> {
  if (activeFetch) {
    activeFetch.abort();
  }
  activeFetch = new AbortController();

  try {
    const fetchUrl = new URL(url, location.origin);
    fetchUrl.searchParams.set("_depth", "1");

    const response = await fetch(fetchUrl.toString(), {
      signal: activeFetch.signal,
      credentials: "same-origin",
      headers: { "X-Requested-With": "frame-swap" },
    });

    if (!response.ok && response.status >= 500) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const doc = parser.parseFromString(html, "text/html");

    const bodyHtml = doc.body.innerHTML;
    const title = doc.title;

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: "frame:swap",
          bodyHtml,
          title,
          url,
          statusCode: response.status,
        },
        "*",
      );
    }

    // For popstate, use replaceState
    history.replaceState({ index: -1 }, "", url);

    activeFetch = null;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;

    console.warn("[frame-navigator] PopState fetch failed, falling back:", e);
    iframe.src = url.includes("?")
      ? `${url}&_depth=1`
      : `${url}?_depth=1`;
    activeFetch = null;
  }
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Phase 2 (needs `frame-router.ts` for iframe reference).

---

### Task 5.2 — Modify `frame-child.ts` — intercept navigations and handle swaps 🔲

**File:** `src/infrastructure/client/frame-child.ts` (modify)

**What:** Replace the existing link click interception with a version that sends `frame:navigate` to the parent instead of appending `_depth` and navigating directly. Add a `listenForSwap()` function that receives `frame:swap` messages and replaces `document.body.innerHTML`.

The existing `frame-child.ts` intercepts clicks and appends `_depth=N`. In the fetch+swap model, we instead:
1. Intercept the click, prevent default, and send `frame:navigate` to parent
2. Parent fetches the page, extracts `<body>`, sends `frame:swap` back
3. Child receives `frame:swap` and swaps `document.body.innerHTML`

Replace the existing click handler (lines 55-76) with:

```ts
// Intercept link clicks — send to parent for fetch+swap instead of navigating
document.addEventListener("click", (e: MouseEvent) => {
  const target = (e.target as HTMLElement).closest("a");
  if (!target) return;

  // Let links with target="_top" through — they break out of the iframe
  if (target.target === "_top") return;

  // Only intercept same-origin links
  if (target.origin !== location.origin) return;

  // Don't interfere with modifier clicks (open in new tab, etc.)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  e.preventDefault();

  // Send to parent for fetch+swap navigation
  const url = new URL(target.href, location.origin);
  url.searchParams.delete("_depth");
  parent.postMessage(
    { type: "frame:navigate", path: url.pathname + url.search },
    "*",
  );
});
```

Remove the existing form submission handler (it will be replaced in Task 5.4).

Add a `listenForSwap()` function:

```ts
/** Listen for frame:swap messages and replace body content. */
function listenForSwap(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "frame:swap") return;
    if (event.source !== parent) return;

    const { bodyHtml, title, statusCode } = event.data as {
      bodyHtml: string;
      title: string;
      url: string;
      statusCode: number;
    };

    // Swap body content
    document.body.innerHTML = bodyHtml;

    // Update page title
    if (title) {
      document.title = title;
    }

    // Re-initialize client-side handlers
    if (typeof (window as any).__restartHandlers === "function") {
      (window as any).__restartHandlers();
    }

    // Re-run height reporting for new content
    reportHeight();

    // Scroll to top
    window.scrollTo(0, 0);

    // Optionally: mark error state
    if (statusCode >= 400) {
      document.body.dataset.frameError = String(statusCode);
    }
  });
}
```

Add `listenForSwap()` to the auto-initialization block.

**Dependencies:** Task 5.1.

---

### Task 5.3 — Modify `frame-router.ts` — replace iframe navigation with fetch+swap 🔲

**File:** `src/infrastructure/client/frame-router.ts` (modify)

**What:** Replace `iframe.src` navigation in `onFrameNavigate` and `onPopState` with fetch+swap.

Add import:

```ts
import { fetchAndSwap, fetchAndSwapForPopState } from "./frame-navigator";
```

Modify `onFrameNavigate`:

```ts
function onFrameNavigate(event: MessageEvent) {
  if (event.data?.type !== "frame:navigate") return;
  if (event.source === null) return;

  const { path } = event.data;
  const frameId = findFrameId(event.source);
  if (!frameId) return;

  const iframe = document.querySelector(
    `iframe[name="${frameId}"]`,
  ) as HTMLIFrameElement | null;
  if (!iframe) return;

  // Fetch the page and swap content instead of navigating the iframe
  fetchAndSwap(path, iframe);

  // Track history entry
  const entry: HistoryEntry = { path, frameId, frameSrc: path };
  historyStack.push(entry);
}
```

Modify `onPopState`:

```ts
function onPopState(_event: PopStateEvent) {
  const targetPath = location.pathname + location.search;
  const frame = document.querySelector(
    "iframe[name='frame-1']",
  ) as HTMLIFrameElement | null;

  if (frame) {
    // Fetch and swap instead of changing iframe.src
    fetchAndSwapForPopState(targetPath, frame);
  }
}
```

**Verify:** Visit `/tenets`. Click a link in the iframe. The content should swap without a full page reload. The address bar should update. No CSS/JS reload.

**Dependencies:** Task 5.1.

---

### Task 5.4 — Handle form submissions via fetch+swap 🔲

**File:** `src/infrastructure/client/frame-child.ts` (modify)

**What:** Replace the existing form submission handler with a fetch+swap version that intercepts form submissions, fetches the response, and swaps content locally.

Replace the existing form submission handler (currently lines 78-100) with:

```ts
/** Intercept form submissions and send via fetch+swap. */
function interceptForms(): void {
  document.addEventListener("submit", async (e: SubmitEvent) => {
    const form = e.target as HTMLFormElement;
    if (!form || !form.action) return;

    // Let forms with target="_top" through — they break out of the iframe
    if (form.target === "_top") return;

    // Only intercept same-origin forms
    try {
      const formOrigin = new URL(form.action, location.origin).origin;
      if (formOrigin !== location.origin) return;
    } catch {
      return;
    }

    e.preventDefault();

    const method = (form.method || "GET").toUpperCase();
    const actionUrl = new URL(form.action, location.origin);
    actionUrl.searchParams.set("_depth", String(depth));

    try {
      let response: Response;

      if (method === "GET") {
        // GET forms: redirect via frame:navigate
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
          actionUrl.searchParams.set(key, value as string);
        }
        parent.postMessage(
          { type: "frame:navigate", path: actionUrl.pathname + actionUrl.search },
          "*",
        );
      } else {
        // POST/PUT/DELETE: fetch and swap locally
        const formData = new FormData(form);
        response = await fetch(actionUrl.toString(), {
          method,
          body: formData,
          credentials: "same-origin",
          headers: { "X-Requested-With": "frame-swap" },
        });

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        // Swap body content
        document.body.innerHTML = doc.body.innerHTML;
        if (doc.title) document.title = doc.title;

        // Re-initialize handlers
        if (typeof (window as any).__restartHandlers === "function") {
          (window as any).__restartHandlers();
        }

        reportHeight();
        window.scrollTo(0, 0);

        // Announce navigation for address bar update
        announce();
      }
    } catch (err) {
      console.warn("[frame-child] Form submission failed, falling back:", err);
      // Fallback: submit the form normally
      form.submit();
    }
  });
}
```

Add `interceptForms()` to the auto-initialization block.

**Verify:** Submit the "Propose a Tenet" form inside the iframe. The response should swap in without a full page reload.

**Dependencies:** Task 5.2.

---

### Task 5.5 — Handle error pages in fetch+swap 🔲

**File:** `src/infrastructure/client/frame-navigator.ts` (modify)

**What:** When `fetch()` returns a non-200 status, still extract and swap the `<body>` content. Error pages rendered by FrameShell are valid swap targets. Network errors fall back to full `iframe.src` navigation.

The existing `fetchAndSwap` and `fetchAndSwapForPopState` functions already handle this — they swap content for any response (including 4xx). The only errors that throw are 5xx server errors, which fall back to `iframe.src` navigation.

Add more granular error handling:

- 4xx responses (404, 403): still swap the content — the error page is useful
- 5xx responses: fall back to full navigation
- Network errors (fetch fails entirely): fall back to full navigation

The `frame:swap` message includes `statusCode` so the child frame can adjust behavior (e.g., adding a `data-frame-error` attribute).

**Dependencies:** Tasks 5.2, 5.3.

---

### Task 5.6 — Restart client-side handlers after swap 🔲

**File:** `src/infrastructure/client/main.ts` (modify), `src/infrastructure/client/dispatcher.ts` (modify)

**What:** After a `frame:swap`, re-initialize all client-side handlers by calling `start()` from the dispatcher again. Export a `__restartHandlers` function for the child frame to call.

In `main.ts`, add a global restart function:

```ts
function restartHandlers(): void {
  start();
}

// Expose for frame-child.ts to call after DOM swaps
(window as any).__restartHandlers = restartHandlers;
```

Verify that `dispatcher.ts`'s `start()` function is idempotent — calling it multiple times should be safe (it should re-query the DOM for `data-controller`/`data-action` attributes on each call). If it uses a `started` flag, add a `restart()` method that clears it.

**Verify:** Navigate within the iframe. After a DOM swap, click a button that uses a client-side handler (e.g., DismissHandler). The handler should work correctly on the new content.

**Dependencies:** Task 5.2.

---

### Task 5.7 — Test fetch+swap navigation 🔲

**What:** Comprehensive manual testing of fetch+swap navigation.

**Test cases:**

1. **Link click:** Click a link in the iframe. Content should swap without CSS/JS reload. Address bar should update.

2. **Back/forward:** Navigate several times, then press back. Content should swap to the previous page. Press forward — should swap forward.

3. **Form submission:** Submit the "Propose a Tenet" form. The response should swap in without full page reload.

4. **Error pages:** Navigate to a non-existent page. The 404 error page should swap in correctly.

5. **Direct URL access (no JS):** Disable JavaScript and visit a page. Should fall back to full page loads (existing behavior).

6. **Auth redirect:** If not logged in, visit a protected page. The `frameRedirect` should still break out of the iframe.

7. **Network error:** Simulate a network error (offline mode). Should fall back to full `iframe.src` navigation.

8. **Handler re-initialization:** After a DOM swap, verify that client-side handlers (DismissHandler, VoteHandler, etc.) work correctly on the new content.

**Dependencies:** Tasks 5.1–5.6.

---

## Phase 6: iframe Sizing — 🔲 NOT STARTED

Make iframes fill their containers properly. Phase 1's CSS already handles the basic flexbox layout. Phase 2 included height reporting (pulled forward from the original Phase 3). This phase is about verifying the CSS and testing sizing behavior.

> **Note:** Tasks 6.1–6.3 code is complete (pulled forward into Phase 2). Only Task 6.4 (testing) remains.

---

### Task 6.1 — Layout CSS for flexbox viewport fill ✅ (done in Task 1.10)

**File:** `src/views/styles/layout.css` (already modified in Task 1.10)

**What:** The CSS from Task 1.10 already handles the basic flexbox layout.

**Verify:** Visit `/tenets`. The iframe should fill the viewport below the header. Resize the browser window — the iframe should resize accordingly.

**Dependencies:** Task 1.10.

---

### Task 6.2 — FrameShell height reporting via ResizeObserver + postMessage ✅ (pulled forward into Phase 2)

**File:** `src/infrastructure/client/frame-child.ts` (already modified in Phase 2)

**What:** Already implemented as part of Phase 2. The `ResizeObserver`-based height reporting and `frame:resize` messages are in the codebase.

**Dependencies:** Task 2.2.

---

### Task 6.3 — frame-router height listener ✅ (pulled forward into Phase 2)

**File:** `src/infrastructure/client/frame-router.ts` (already modified in Phase 2)

**What:** Already implemented as part of Phase 2. The `frame:resize` message listener is in the codebase.

**Dependencies:** Task 2.1.

---

### Task 6.4 — Test sizing 🔲

**What:** Manual testing of iframe sizing.

**Test cases:**

1. **Viewport fill:** Visit `/tenets`. The iframe should fill the viewport below the header. No scrollbars on the outer page — only inside the iframe.

2. **Dynamic content:** Navigate to a tenet detail page inside the iframe. The iframe should resize to fit the content.

3. **Resize:** Resize the browser window. The iframe should resize accordingly.

4. **Long content:** View a tenet with lots of content. The iframe should expand to show all content without clipping.

**Dependencies:** Tasks 6.1, 6.2, 6.3.

---

## Phase 7: Multi-Outlet via DOM Swap (Stretch) — 🔲 NOT STARTED

Instead of multiple iframes (sidebar + detail), use a single iframe at depth 1 whose content includes both sidebar and detail. Navigation within the detail pane uses fetch+swap (Phase 5). Clicking a sidebar item fetches the full page and swaps the entire body. The sidebar is re-rendered each time but it's instant since only HTML is parsed (no CSS/JS reload). A potential future enhancement uses partial swaps (`frame:swap-partial` with a target selector) to only update the detail pane.

> **Key design change:** The original Phase 4 (Multi-Outlet) used multiple iframes. Phase 5 (Fetch + DOM Swap) makes that design incompatible because Phase 5 doesn't navigate iframes — it swaps content in place. This redesigned Phase 7 uses a single iframe with fetch+swap for content updates.

---

### Task 7.1 — Create section view for Tenets (sidebar + detail) 🔲

**File:** `src/views/pages/Tenets/views/section.tsx` (new)

**What:** A section shell with a sidebar (tenet list) and a detail pane. Uses CSS Grid for layout. Rendered at depth 1 by the controller.

```tsx
// src/views/pages/Tenets/views/section.tsx

import type { FC } from "hono/jsx";
import styles from "./section.module.css";

interface SectionViewProps {
  tenets: { slug: string; name: string; status: string }[];
  activeSlug?: string;
}

/**
 * Section shell for the tenets area.
 * Contains a sidebar (tenet list) and a detail pane.
 * Rendered at depth 1. Navigation within the detail pane
 * uses fetch+swap (Phase 5).
 */
export const SectionView: FC<SectionViewProps> = ({ tenets, activeSlug }) => (
  <div class={styles.tenetsLayout}>
    <aside class={styles.sidebar}>
      <nav>
        <ul>
          {tenets.map((tenet) => (
            <li class={tenet.slug === activeSlug ? styles.active : undefined}>
              <a href={`/tenets/${tenet.slug}`}>{tenet.name}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
    <div class={styles.detailPane} data-frame-region="detail">
      <p>Select a tenet from the sidebar.</p>
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

.sidebar {
  overflow-y: auto;
  border-right: 1px solid var(--pico-muted-border-color);
  padding: var(--pico-block-spacing-vertical) var(--pico-block-spacing-horizontal);
}

.active a {
  font-weight: bold;
}

.detailPane {
  overflow-y: auto;
  padding: var(--pico-block-spacing-vertical) var(--pico-block-spacing-horizontal);
}
```

**Verify:** `npx tsc --noEmit` passes.

**Dependencies:** Phase 5 (needs fetch+swap for detail pane navigation).

---

### Task 7.2 — Modify TenetsController for depth-aware rendering 🔲

**File:** `src/views/pages/Tenets/controller.tsx` (modify)

**What:** Change the controller to render different views based on depth.

- **Depth 0:** Layout renders Outlet → `/tenets?_depth=1`
- **Depth 1:** Render section view (sidebar + detail)
- **Depth 2+:** Render leaf content (individual tenet view — content for fetch+swap)

```tsx
import { getFrameDepth } from "infrastructure/FrameContext";

// In the controller:

@Get("/")
async index(c: Context) {
  const depth = getFrameDepth();
  const user = c.get("user") as unknown as UserRow;
  const result = await tenetService.list((c.env as CloudflareBindings).DB);

  if (depth === 1) {
    // Section view with sidebar + detail
    return c.render(<SectionView tenets={result.tenets} />);
  }

  // Depth 0: Layout renders Outlet → depth 1
  // Depth 2+: Just the list (leaf content for swap-in)
  return c.render(
    <IndexView {...viewBuilder.index(result.tenets, user)} />,
  );
}

@Get("/:slug")
async show(c: Context) {
  const depth = getFrameDepth();
  const tenetRow = c.get("tenet") as TenetRow;
  const user = c.get("user") as unknown as UserRow;
  const detail = await tenetService.getBySlug(
    (c.env as CloudflareBindings).DB, tenetRow.slug,
  );

  if (depth === 1) {
    // At depth 1, render section view with this tenet active
    const result = await tenetService.list((c.env as CloudflareBindings).DB);
    return c.render(
      <SectionView tenets={result.tenets} activeSlug={tenetRow.slug} />,
    );
  }

  // Depth 2+: leaf view
  return c.render(<ShowView {...viewBuilder.show(detail, user)} />);
}
```

**Verify:** Visit `/tenets` at depth 0 → Layout with Outlet. Visit `/tenets?_depth=1` → section view with sidebar and detail pane.

**Dependencies:** Task 7.1.

---

### Task 7.3 — Add named content regions for partial swaps (optional) 🔲

**File:** `src/views/pages/Tenets/views/section.tsx` (modify), `src/infrastructure/client/frame-child.ts` (modify)

**What:** Add `data-frame-region` attributes to content sections. When fetch+swap receives content, it can optionally swap only a targeted region instead of the entire `<body>`. This prevents sidebar "flicker" when only the detail pane changes.

In `section.tsx`, the `data-frame-region="detail"` attribute is already on the detail pane div.

In `frame-child.ts`, add a `frame:swap-partial` listener:

```ts
function listenForPartialSwap(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "frame:swap-partial") return;
    if (event.source !== parent) return;

    const { region, html, title } = event.data as {
      region: string;
      html: string;
      title?: string;
    };

    const target = document.querySelector(
      `[data-frame-region="${region}"]`,
    );
    if (target) {
      target.innerHTML = html;
    } else {
      // Region not found — fall back to full body swap
      document.body.innerHTML = html;
    }

    if (title) document.title = title;

    if (typeof (window as any).__restartHandlers === "function") {
      (window as any).__restartHandlers();
    }

    reportHeight();
  });
}
```

This is an optional enhancement. Full body swap works correctly — partial swaps are an optimization to avoid re-rendering unchanged sidebar content.

**Dependencies:** Task 7.1.

---

### Task 7.4 — Test multi-outlet navigation 🔲

**What:** Manual testing of the sidebar + detail pattern.

**Test cases:**

1. **Section view loads:** Visit `/tenets`. Should see sidebar with tenet list and detail pane.

2. **Click tenet in sidebar:** Should update the detail pane via fetch+swap. The sidebar should not re-render (or should re-render instantly with partial swap from Task 7.3).

3. **Address bar updates:** The address bar should update to `/tenets/some-slug` when a tenet is selected.

4. **Back button:** Pressing back should navigate the detail pane back through history.

5. **Deep link:** Visit `/tenets/some-slug` directly. Should load the section view with that tenet in the detail pane.

6. **Sidebar active state:** The active tenet in the sidebar should be highlighted.

**Dependencies:** Tasks 7.1–7.3.

---

## Summary: File Changes by Phase

### Phase 1 — New Files ✅
| File | Purpose | Status |
|---|---|---|
| `src/infrastructure/FrameContext.ts` | Module-level frame context (depth + path) | ✅ |
| `src/infrastructure/frameMiddleware.ts` | Hono middleware to extract `_depth` from query | ✅ |
| `src/views/components/Outlet/index.tsx` | `<Outlet />` component (renders as `<iframe>`) | ✅ |
| `src/views/pages/Shared/FrameShell.tsx` | Minimal HTML shell for nested frames | ✅ |
| `src/views/pages/Shared/FrameShell.module.css` | FrameShell body styles | ✅ |

### Phase 1 — Modified Files ✅
| File | Change | Status |
|---|---|---|
| `src/infrastructure/ControllerBase.tsx` | Depth-aware renderer (Layout at depth 0, FrameShell at depth 1+). Uses `getFrameDepth()` instead of `c.get("frameDepth")` due to Hono sub-app context isolation. | ✅ |
| `src/views/pages/Shared/Layout.tsx` | Add `depth` prop, render `<Outlet />` at depth 0 | ✅ |
| `src/middlewares/auth.tsx` | `frameRedirect()` helper for depth-aware auth redirects | ✅ |
| `src/infrastructure/errors/index.tsx` | Depth-aware error rendering (FrameShell at depth > 0) | ✅ |
| `src/views/pages/Shared/Results.tsx` | Add `depth` prop, skip Layout wrapper at depth > 0 | ✅ |
| `src/index.tsx` | Register `frameMiddleware` | ✅ |
| `src/views/styles/layout.css` | Flexbox rules for iframe sizing | ✅ |

> **Bug fix:** Deleted obsolete `Outlet.tsx` that was shadowing `Outlet/index.tsx` (was using `window.location.pathname` which doesn't work server-side).

### Phase 2 — New Files ✅
| File | Purpose | Status |
|---|---|---|
| `src/infrastructure/client/frame-router.ts` | Top-level history manager + `frame:resize` listener (Phase 6 feature pulled forward) | ✅ |
| `src/infrastructure/client/frame-child.ts` | Child frame navigation announcer + link/form interception + `_depth` rewriting + ResizeObserver height reporting (Phase 6 features pulled forward) | ✅ |

### Phase 2 — Modified Files ✅
| File | Change | Status |
|---|---|---|
| `src/infrastructure/client/main.ts` | Import frame-router and frame-child | ✅ |
| `src/views/pages/Shared/Layout.tsx` | No separate script tag needed — bundled via main.ts | ✅ |
| `src/views/pages/Shared/FrameShell.tsx` | No separate script tag needed — bundled via main.ts | ✅ |

### Phase 3 — Modified Files 🔲
| File | Change | Status |
|---|---|---|
| `src/views/pages/Shared/Layout.tsx` | Add `preload` and `modulepreload` hints | 🔲 |

### Phase 4 — New Files 🔲
| File | Purpose | Status |
|---|---|---|
| `src/infrastructure/client/frame-styles.ts` | Parent-side CSS text fetcher and sender for `adoptedStyleSheets` sharing | 🔲 |

### Phase 4 — Modified Files 🔲
| File | Change | Status |
|---|---|---|
| `src/infrastructure/client/frame-router.ts` | Call `shareStylesWithFrame` after iframe navigation and on load | 🔲 |
| `src/infrastructure/client/frame-child.ts` | Listen for `frame:styles`, apply via `adoptedStyleSheets`, remove redundant `<link>` | 🔲 |

### Phase 5 — New Files 🔲
| File | Purpose | Status |
|---|---|---|
| `src/infrastructure/client/frame-navigator.ts` | Parent-side fetch orchestrator (fetch page, extract `<body>`, send `frame:swap`) | 🔲 |

### Phase 5 — Modified Files 🔲
| File | Change | Status |
|---|---|---|
| `src/infrastructure/client/frame-router.ts` | Replace `iframe.src` navigation with `fetchAndSwap()`; add loading state management | 🔲 |
| `src/infrastructure/client/frame-child.ts` | Intercept link clicks and form submissions; listen for `frame:swap`; swap `document.body.innerHTML`; re-initialize handlers | 🔲 |
| `src/infrastructure/client/main.ts` | Expose `__restartHandlers` for post-swap handler re-init | 🔲 |

### Phase 6 — Modified Files ✅ (code complete, testing pending)
| File | Change | Status |
|---|---|---|
| `src/infrastructure/client/frame-child.ts` | ResizeObserver height reporting | ✅ (pulled forward to Phase 2) |
| `src/infrastructure/client/frame-router.ts` | `frame:resize` message listener | ✅ (pulled forward to Phase 2) |

### Phase 7 — New Files 🔲
| File | Purpose | Status |
|---|---|---|
| `src/views/pages/Tenets/views/section.tsx` | Section view with sidebar + detail (single iframe, CSS Grid) | 🔲 |
| `src/views/pages/Tenets/views/section.module.css` | Grid layout for sidebar + detail | 🔲 |

### Phase 7 — Modified Files 🔲
| File | Change | Status |
|---|---|---|
| `src/views/pages/Tenets/controller.tsx` | Depth-aware rendering: section view at depth 1, leaf content at depth 2+ | 🔲 |
| `src/infrastructure/client/frame-child.ts` | Listen for `frame:swap-partial` messages (optional) | 🔲 |
| `src/infrastructure/client/frame-navigator.ts` | Support partial swaps with `data-frame-region` (optional) | 🔲 |

---

## Implementation Order

```
Phase 1 (Foundation): ✅ COMPLETE
Phase 2 (History & Navigation): ⚡ IN PROGRESS
  2.6 testing pending

Phase 3 (Preload Hints — no risk): 🔲
  3.1 Add preload hints to Layout.tsx     🔲 depends on Phase 1
  3.2 Test preload timing                  🔲 depends on 3.1

Phase 4 (adoptedStyleSheets — moderate): 🔲
  4.1 Create frame-styles.ts               🔲 depends on Phase 2
  4.2 Modify frame-router.ts               🔲 depends on 4.1
  4.3 Modify frame-child.ts                🔲 depends on 4.1
  4.4 Test style sharing                   🔲 depends on 4.1–4.3

Phase 5 (Fetch + DOM Swap — high impact): 🔲
  5.1 Create frame-navigator.ts            🔲 depends on Phase 2
  5.2 Modify frame-child.ts                🔲 depends on 5.1
  5.3 Modify frame-router.ts               🔲 depends on 5.1
  5.4 Handle form submissions               🔲 depends on 5.2
  5.5 Handle error pages                    🔲 depends on 5.2, 5.3
  5.6 Restart handlers after swap          🔲 depends on 5.2
  5.7 Test fetch+swap navigation           🔲 depends on 5.1–5.6

Phase 6 (iframe Sizing — code done): 🔲
  6.1 Verify layout CSS                    ✅ (done in 1.10)
  6.2 frame-child height                   ✅ (done in 2.2)
  6.3 frame-router height                  ✅ (done in 2.1)
  6.4 Test sizing                          🔲 depends on all above

Phase 7 (Multi-Outlet via DOM Swap — stretch): 🔲
  7.1 Create section view                  🔲 depends on Phase 5
  7.2 Modify TenetsController for depth    🔲 depends on 7.1
  7.3 Named content regions (optional)    🔲 depends on 7.1
  7.4 Test multi-outlet navigation         🔲 depends on 7.1–7.3
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
| Phase 5 DOM swap breaks JS state | High | Re-initialize handlers via `__restartHandlers()` after swap; test all interactive components |
| Phase 5 fetch fails on network error | Medium | Fall back to full `iframe.src` navigation; `frameRedirect` still works for auth |
| Phase 5/7 incompatibility with multiple iframes | High | Phase 7 redesigned: single iframe + fetch+swap instead of multiple iframes. Original multi-iframe approach is abandoned. |
| `adoptedStyleSheets` browser support | Medium | Chrome 73+, Firefox 101+, Safari 16.4+ — covers >95% of users. `<link>` tag remains as fallback. |

---

## Key Design Decisions & Deviations from Original Plan

### 1. `frame-child.ts` intercepts links and forms (not just `postMessage`)

**Original plan:** `frame-child.ts` would only announce navigation to the parent via `postMessage`.

**Actual implementation:** `frame-child.ts` also **intercepts link clicks and form submissions** to automatically append `_depth=N` to URLs. This means templates don't need manual URL rewriting — the client script handles it transparently.

### 2. No separate `<script>` tags for frame scripts

**Original plan:** Tasks 2.3 and 2.4 called for adding separate `<script>` tags to `FrameShell.tsx` and `Layout.tsx` for `frame-child.ts` and `frame-router.ts` respectively.

**Actual implementation:** Both scripts are imported from `main.ts` and bundled into the single main client JS bundle. They self-activate based on the presence/absence of `_depth` in the URL:
- `frame-child.ts` only activates when `_depth` is present (depth > 0)
- `frame-router.ts` only activates when `_depth` is absent (depth 0 / top-level frame)

This eliminates the need for conditional script tags in server-rendered templates.

### 3. Phase 6 features pulled forward into Phase 2 (originally Phase 3)

**Original plan:** `ResizeObserver` height reporting (original Task 3.2) and `frame:resize` message handling (original Task 3.3) were separate Phase 3 tasks.

**Actual implementation:** Both features were implemented as part of Phase 2 since they share the same `postMessage` infrastructure. `frame-child.ts` includes the `ResizeObserver` height reporting, and `frame-router.ts` includes the `frame:resize` message listener.

### 4. `getFrameDepth()` instead of `c.get("frameDepth")`

**Original plan:** `ControllerBase.tsx` would read `frameDepth` from the Hono context via `c.get("frameDepth")`.

**Actual implementation:** Changed to use `getFrameDepth()` from `FrameContext` (module-level state). This was necessary because Hono sub-apps get a fresh context, so context variables set by middleware on the parent app don't carry over to sub-app controllers.

### 5. Deleted obsolete `Outlet.tsx`

**Bug found and fixed:** An obsolete `Outlet.tsx` file was shadowing `Outlet/index.tsx`. The old file used `window.location.pathname` which doesn't work server-side. The file was deleted.

### 6. Phase 5 vs Phase 7 incompatibility — redesign of multi-outlet approach

**Original plan:** Phase 4 (now Phase 7) used multiple iframes for section views — a sidebar iframe and a detail iframe side by side, coordinated via `frame:outlet` messages.

**Redesign:** Phase 5 (Fetch + DOM Swap) replaces iframe navigation with in-place DOM content swapping. This makes the multi-iframe approach incompatible because:
- Phase 5 doesn't navigate iframes — it swaps content in place
- Multiple iframes would each need their own fetch+swap system, adding complexity
- Synchronizing state across iframes (active sidebar item, scroll position) is fragile

**New approach:** Phase 7 now uses a **single iframe at depth 1** whose content includes both sidebar and detail. Navigation within the detail pane uses fetch+swap. Clicking a sidebar item triggers a full body swap (instant since only HTML is parsed, no CSS/JS reload). A future enhancement could use partial swaps (`frame:swap-partial` with `data-frame-region`) to only update the detail pane, avoiding sidebar re-render.

### 7. Preload hints before adoptedStyleSheets (Phase 3 before Phase 4)

**Decision:** Phase 3 (preload hints) is ordered before Phase 4 (`adoptedStyleSheets`) because:
- Preload hints are zero-risk and require no architecture changes
- `adoptedStyleSheets` depends on `postMessage` infrastructure from Phase 2
- Preload hints provide a baseline performance improvement even if `adoptedStyleSheets` is later abandoned or proves unreliable
- Together, they ensure the CSS is available before the iframe needs it (preload) and avoid re-parsing if the browser supports it (`adoptedStyleSheets`)