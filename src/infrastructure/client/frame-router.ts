// src/infrastructure/client/frame-router.ts

/**
 * Top-level history manager for nested frames.
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
function onFrameNavigate(event: MessageEvent): void {
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

/** Handle browser back/forward. */
function onPopState(_event: PopStateEvent): void {
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
  window.addEventListener("message", onFrameResize);
  window.addEventListener("popstate", onPopState);

  // Replace current history entry with our state
  history.replaceState({ index: 0 }, "", location.pathname);
}

// Auto-initialize at depth 0 only (top-level frame)
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (!params.has("_depth")) {
    initFrameRouter();
  }
}