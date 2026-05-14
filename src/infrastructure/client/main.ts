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

// Frame navigation — intercepts links/forms in nested frames to preserve _depth
import "./frame-child";

console.log("js-mvc client loaded");

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
