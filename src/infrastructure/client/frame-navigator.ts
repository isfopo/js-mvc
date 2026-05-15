// src/infrastructure/client/frame-navigator.ts

/**
 * Parent-side navigation orchestrator.
 * Fetches page HTML, extracts <body> content, and sends it
 * to the child iframe for DOM swapping instead of full navigation.
 */

let activeFetch: AbortController | null = null;

const parser = new DOMParser();

/** Build a fallback URL with _depth=1 using the URL API. */
function buildFallbackUrl(url: string): string {
  const fallbackUrl = new URL(url, location.origin);
  fallbackUrl.searchParams.set("_depth", "1");
  return fallbackUrl.toString();
}

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
      // SECURITY: bodyHtml is fetched from the same origin and sent to
      // a same-origin iframe via postMessage. No sanitization is applied
      // (same-origin trust model). See frame-child.ts for where it's injected.
      iframe.contentWindow.postMessage(
        {
          type: "frame:swap",
          bodyHtml,
          title,
          url, // original URL (without _depth)
          statusCode: response.status,
        },
        location.origin,
      );
    }

    // Update address bar
    history.pushState({ index: -1 }, "", url);

    activeFetch = null;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;

    console.warn("[frame-navigator] Fetch failed, falling back to navigation:", e);
    // Fallback: navigate the iframe directly
    iframe.src = buildFallbackUrl(url);
    // Still update the address bar even on fallback
    history.pushState({ index: -1 }, "", url);
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
        location.origin,
      );
    }

    // For popstate, use replaceState
    history.replaceState({ index: -1 }, "", url);

    activeFetch = null;
  } catch (e) {
    if ((e as Error).name === "AbortError") return;

    console.warn("[frame-navigator] PopState fetch failed, falling back:", e);
    iframe.src = buildFallbackUrl(url);
    // Still update the address bar even on fallback
    history.replaceState({ index: -1 }, "", url);
    activeFetch = null;
  }
}
