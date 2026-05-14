// src/infrastructure/client/frame-child.ts

/**
 * Client script for nested frames (depth > 0).
 *
 * 1. Intercepts same-origin link clicks and form submissions,
 *    appending _depth=N so the server renders FrameShell instead of Layout.
 * 2. Announces navigation to the parent frame via postMessage
 *    so the address bar stays in sync (Phase 2).
 */

/** Get the current frame depth from the URL query string. */
function getCurrentDepth(): number {
  const params = new URLSearchParams(location.search);
  const d = params.get("_depth");
  return d ? parseInt(d, 10) : 0;
}

/** Append _depth to a URL if it's a same-origin path. Returns the modified URL. */
function withDepth(url: string, depth: number): string {
  try {
    const parsed = new URL(url, location.origin);
    // Only rewrite same-origin URLs
    if (parsed.origin !== location.origin) return url;
    // Don't rewrite if _depth is already present
    if (parsed.searchParams.has("_depth")) return url;
    parsed.searchParams.set("_depth", String(depth));
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return url;
  }
}

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

/** Observe content height changes and report to parent. */
function initHeightReporting(): void {
  // Initial report
  reportHeight();

  // Observe body size changes
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
  }
}

// Only activate in nested frames (depth > 0)
const depth = getCurrentDepth();
if (depth > 0) {
  // Announce initial navigation to parent
  announce();

  // Report content height to parent for dynamic iframe sizing
  initHeightReporting();

  // Intercept link clicks — append _depth to same-origin URLs
  document.addEventListener("click", (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    // Let links with target="_top" through — they break out of the iframe
    if (target.target === "_top") return;

    // Only intercept same-origin links
    if (target.origin !== location.origin) return;

    // Don't interfere with modifier clicks (open in new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Rewrite the href to include _depth
    const newHref = withDepth(target.href, depth);
    if (newHref !== target.href) {
      // Prevent default and navigate manually
      e.preventDefault();
      location.href = newHref;
    }
  });

  // Intercept form submissions — append _depth to the action URL
  document.addEventListener("submit", (e: SubmitEvent) => {
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

    // Rewrite the action to include _depth
    const newAction = withDepth(form.action, depth);
    if (newAction !== form.action) {
      form.action = newAction;
      // Let the form submit normally with the new action
    }
  });

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
}