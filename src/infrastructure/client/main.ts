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
import { start, restart } from "./dispatcher";

// Frame navigation — intercepts links/forms in nested frames to preserve _depth
import "./frame-child";
// Frame history — keeps browser address bar in sync with iframe navigation
import "./frame-router";

if (import.meta.env.DEV) console.log("js-mvc client loaded");

// --- DOM helpers ---

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

// --- Handler restart for frame swaps ---

/** Re-initialize client-side handlers after a DOM swap. */
function restartHandlers(): void {
  restart();
}

// Expose for frame-child.ts to call after DOM swaps
(window as any).__jsMvc_restartHandlers = restartHandlers;
