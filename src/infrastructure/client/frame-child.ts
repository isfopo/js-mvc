// src/infrastructure/client/frame-child.ts

/**
 * Client script for nested frames (depth > 0).
 *
 * 1. Intercepts same-origin link clicks and sends them to the parent
 *    frame via `frame:navigate` for fetch+swap navigation instead of
 *    full-page reloads.
 * 2. Intercepts same-origin form submissions: GET forms are sent to the
 *    parent as `frame:navigate`, POST/PUT/DELETE forms are fetched locally
 *    and the response body is swapped in-place.
 * 3. Listens for `frame:swap` messages from the parent to replace body
 *    content when the parent performs fetch+swap on behalf of this frame.
 * 4. Announces navigation to the parent frame via postMessage
 *    so the address bar stays in sync.
 */

/** Get the current frame depth from the URL query string. */
function getCurrentDepth(): number {
  const params = new URLSearchParams(location.search);
  const d = params.get("_depth");
  return d ? parseInt(d, 10) : 0;
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
    location.origin,
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
    location.origin,
  );
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

      // Remove any previously shared sheets to prevent accumulation on navigation
      const keep = document.adoptedStyleSheets.filter(
        (s) => !(s as any).__frameShared,
      );
      (sheet as any).__frameShared = true;
      document.adoptedStyleSheets = [...keep, sheet];

      // Mark that styles were shared so FrameShell can skip <link>
      (window as any).__frameStylesShared = true;

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

    // SECURITY: innerHTML content comes from same-origin fetch().
    // No sanitization is applied (same-origin trust model).
    // If any endpoint has a reflected XSS vulnerability, it would render here.
    document.body.innerHTML = bodyHtml;

    // Update page title
    if (title) {
      document.title = title;
    }

    // Re-initialize client-side handlers
    if (typeof (window as any).__jsMvc_restartHandlers === "function") {
      (window as any).__jsMvc_restartHandlers();
    }

    // Re-run height reporting for new content (re-attaches ResizeObserver)
    initHeightReporting();

    // Scroll to top
    window.scrollTo(0, 0);

    // Optionally: mark error state
    if (statusCode >= 400) {
      document.body.dataset.frameError = String(statusCode);
    }
  });
}

/** ResizeObserver instance — kept at module level so we can disconnect and re-observe after body swaps. */
let heightObserver: ResizeObserver | null = null;

/** Observe content height changes and report to parent. */
function initHeightReporting(): void {
  // Initial report
  reportHeight();

  // Observe body size changes
  if (typeof ResizeObserver !== "undefined") {
    if (heightObserver) heightObserver.disconnect();
    heightObserver = new ResizeObserver(reportHeight);
    heightObserver.observe(document.body);
  }
}

// Only activate in nested frames (depth > 0)
const depth = getCurrentDepth();
if (depth > 0) {
  // Announce initial navigation to parent
  announce();

  // Report content height to parent for dynamic iframe sizing
  initHeightReporting();

  // Listen for shared styles from parent frame
  listenForSharedStyles();

  // Listen for frame:swap messages from parent
  listenForSwap();

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
      location.origin,
    );
  });

  // Intercept form submissions via fetch+swap
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
      if (method === "GET") {
        // GET forms: redirect via frame:navigate
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
          // Skip File entries — GET forms should not submit files
          if (value instanceof File) continue;
          actionUrl.searchParams.set(key, value as string);
        }
        parent.postMessage(
          { type: "frame:navigate", path: actionUrl.pathname + actionUrl.search },
          location.origin,
        );
      } else {
        // POST/PUT/DELETE: fetch and swap locally
        const formData = new FormData(form);
        const response = await fetch(actionUrl.toString(), {
          method,
          body: formData,
          credentials: "same-origin",
          headers: { "X-Requested-With": "frame-swap" },
        });

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        // SECURITY: innerHTML content comes from same-origin fetch().
        // No sanitization is applied (same-origin trust model).
        // If any endpoint has a reflected XSS vulnerability, it would render here.
        document.body.innerHTML = doc.body.innerHTML;
        if (doc.title) document.title = doc.title;

        // Re-initialize handlers
        if (typeof (window as any).__jsMvc_restartHandlers === "function") {
          (window as any).__jsMvc_restartHandlers();
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
