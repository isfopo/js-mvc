/**
 * Client-side entry point for js-mvc.
 * Compiled to public/client/main.js and loaded by the server-rendered layout.
 */

console.log("js-mvc client loaded");

// --- Utility functions ---

/** Throttle a function to run at most once per `delay` ms */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

// --- DOM helpers ---

/** Waits for the DOM to be ready, then runs the callback */
export function onReady(cb: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb);
  } else {
    cb();
  }
}

onReady(() => {
  console.log("js-mvc DOM ready");
});
