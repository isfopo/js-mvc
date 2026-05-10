/**
 * Client-side entry point for js-mvc.
 * Compiled to public/client/main.js and loaded by the server-rendered layout.
 */

// Import each handler to trigger its side-effect registration with the dispatcher
import "../../handlers/DismissHandler";
import "../../handlers/ConfirmHandler";
import "../../handlers/VoteHandler";
import "../../handlers/StatusTransitionHandler";
import { start } from "./dispatcher";

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
