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

import { shareStylesWithFrame } from "./frame-styles";
import { fetchAndSwap, fetchAndSwapForPopState } from "./frame-navigator";

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

  // Send shared styles to the iframe after navigation
  shareStylesWithFrame(iframe);
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
  const targetPath = location.pathname + location.search;
  const frame = document.querySelector(
    "iframe[name='frame-1']",
  ) as HTMLIFrameElement | null;

  if (frame) {
    // Fetch and swap instead of changing iframe.src
    fetchAndSwapForPopState(targetPath, frame);
  }
}

/** Intercept clicks on [data-frame-nav] links in the top-level nav.
 *  Instead of reloading the whole page, fetch the content and swap
 *  it into the child iframe — same as clicking a link inside the iframe.
 */
function onNavClick(e: MouseEvent): void {
  const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-frame-nav]");
  if (!anchor) return;

  // Don't interfere with modifier clicks (open in new tab, etc.)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  // Only intercept same-origin links
  if (anchor.origin !== location.origin) return;

  e.preventDefault();

  const path = anchor.pathname + anchor.search;
  const frame = document.querySelector(
    "iframe[name='frame-1']",
  ) as HTMLIFrameElement | null;

  if (frame) {
    fetchAndSwap(path, frame);

    // Track history entry
    const entry: HistoryEntry = { path, frameId: "frame-1", frameSrc: path };
    historyStack.push(entry);

    // Send shared styles to the iframe after navigation
    shareStylesWithFrame(frame);
  } else {
    // No iframe found — fall back to full navigation
    location.href = anchor.href;
  }
}

/** Initialize the history manager. Call once at top-level. */
export function initFrameRouter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener("message", onFrameNavigate);
  window.addEventListener("message", onFrameResize);
  window.addEventListener("popstate", onPopState);

  // Intercept nav clicks at the top level
  document.addEventListener("click", onNavClick);

  // Replace current history entry with our state
  history.replaceState({ index: 0 }, "", location.pathname);

  // Listen for iframe loads to share styles
  document.querySelectorAll("iframe").forEach((iframe) => {
    iframe.addEventListener("load", () => {
      shareStylesWithFrame(iframe as HTMLIFrameElement);
    });
  });
}

// Auto-initialize at depth 0 only (top-level frame)
if (typeof window !== "undefined") {
  const params = new URLSearchParams(location.search);
  if (!params.has("_depth")) {
    initFrameRouter();
  }
}