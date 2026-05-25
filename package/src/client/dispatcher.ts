/**
 * DOM dispatcher — the client-side "router".
 *
 * Scans the DOM for [data-controller] elements, instantiates the
 * matching handler class, and wires up actions declared via
 * data-action="{event}->{handler}#{method}".
 *
 * Inspired by Stimulus, but zero-dependency and project-specific.
 *
 * Lifecycle order:
 *   beforeConnect → connect → afterConnect
 *   beforeDisconnect → disconnect
 *   appear / disappear (IntersectionObserver-driven)
 */

import type { ActionDescriptor, Handler, HandlerConstructor, LifecycleName } from "./types";
import { onReady } from "./main";

// --- Registry ---

const registry = new Map<string, HandlerConstructor>();

/**
 * Register a handler class so the dispatcher can find it by name.
 * Called at import time by each handler module.
 */
export function register(name: string, ctor: HandlerConstructor): void {
  registry.set(name, ctor);
}

// --- Action parsing ---

const ACTION_RE = /^(\w+)-\s*>\s*(\w+)#(\w+)$/;

function parseAction(raw: string): ActionDescriptor | null {
  const m = raw.trim().match(ACTION_RE);
  if (!m) return null;
  return { event: m[1], handler: m[2], method: m[3] };
}

// --- Scope tracking for disconnect ---

interface ActiveHandler {
  instance: Handler;
  boundListeners: Map<HTMLElement, Map<string, EventListener>>;
  intersectionObserver?: IntersectionObserver;
}

const activeHandlers = new WeakMap<HTMLElement, ActiveHandler[]>();

// --- Error handling ---

/** Safely invoke a lifecycle method, catching errors and delegating to handler.error() */
function invokeLifecycle(
  handler: Handler,
  name: LifecycleName,
): void {
  try {
    const fn = (handler as any)[name];
    if (typeof fn === "function") {
      fn.call(handler);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    try {
      handler.error?.(error, name);
    } catch {
      // If error() itself throws, fall back to console
    }
    console.error(
      `[dispatcher] Error in "${name}" for handler "${(handler.constructor as any).handlerName}":`,
      error,
    );
  }
}

// --- Wiring ---

function connectElement(element: HTMLElement): void {
  const names = (element.getAttribute("data-controller") ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const handlers: ActiveHandler[] = [];

  for (const name of names) {
    const Ctor = registry.get(name);
    if (!Ctor) {
      console.warn(`[dispatcher] No handler registered for "${name}"`);
      continue;
    }

    const instance = new Ctor(element);
    const boundListeners = new Map<HTMLElement, Map<string, EventListener>>();

    // Phase 1: beforeConnect — setup, initial state
    invokeLifecycle(instance, "beforeConnect");

    // Phase 2: connect — abstract, must be implemented
    invokeLifecycle(instance, "connect");

    // Phase 3: wire actions
    function wireAction(target: HTMLElement, raw: string) {
      for (const part of raw.split(";")) {
        const desc = parseAction(part);
        if (desc && desc.handler === name) {
          const fn = (instance as any)[desc.method];
          if (typeof fn === "function") {
            const bound = fn.bind(instance);

            // Track bound listeners for cleanup
            if (!boundListeners.has(target)) {
              boundListeners.set(target, new Map());
            }
            boundListeners.get(target)!.set(desc.event, bound);

            target.addEventListener(desc.event, bound);
          } else {
            console.warn(
              `[dispatcher] Handler "${name}" has no method "${desc.method}"`,
            );
          }
        }
      }
    }

    // Check the element itself
    const selfAction = element.getAttribute("data-action");
    if (selfAction) wireAction(element, selfAction);

    // Check descendants
    element
      .querySelectorAll<HTMLElement>("[data-action]")
      .forEach((target) => wireAction(target, target.getAttribute("data-action") ?? ""));

    // Phase 4: afterConnect — safe to interact with fully wired DOM
    invokeLifecycle(instance, "afterConnect");

    // Phase 5: set up IntersectionObserver for appear/disappear
    let intersectionObserver: IntersectionObserver | undefined;
    if (instance.appear || instance.disappear) {
      let isVisible = false;
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            // Only fire once per visibility change to avoid
            // repeated invocations during scrolling.
            if (entry.isIntersecting && !isVisible) {
              isVisible = true;
              invokeLifecycle(instance, "appear");
            } else if (!entry.isIntersecting && isVisible) {
              isVisible = false;
              invokeLifecycle(instance, "disappear");
            }
          }
        },
        { threshold: 0.1 },
      );
      intersectionObserver.observe(element);
    }

    handlers.push({ instance, boundListeners, intersectionObserver });
  }

  if (handlers.length > 0) {
    activeHandlers.set(element, handlers);
  }
}

function disconnectElement(element: HTMLElement): void {
  const handlers = activeHandlers.get(element);
  if (!handlers) return;

  for (const { instance, boundListeners, intersectionObserver } of handlers) {
    // Phase 1: beforeDisconnect — pre-cleanup
    invokeLifecycle(instance, "beforeDisconnect");

    // Phase 2: disconnect — abstract cleanup
    invokeLifecycle(instance, "disconnect");

    // Phase 3: remove all bound event listeners
    for (const [target, listeners] of boundListeners) {
      for (const [event, listener] of listeners) {
        target.removeEventListener(event, listener);
      }
    }

    // Phase 4: disconnect IntersectionObserver
    intersectionObserver?.disconnect();
  }

  activeHandlers.delete(element);
}

// --- DOM scanning ---

function scan(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>("[data-controller]")
    .forEach(connectElement);
}

// --- MutationObserver for dynamic content ---

function createObserver(): MutationObserver {
  return new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Connect new elements
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute?.("data-controller")) {
            connectElement(el);
          }
          // Also scan descendants
          if (el.querySelectorAll) {
            el.querySelectorAll<HTMLElement>("[data-controller]").forEach(
              connectElement,
            );
          }
        }
      }
      // Disconnect removed elements
      for (const node of mutation.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          disconnectElement(el);
          if (el.querySelectorAll) {
            el.querySelectorAll<HTMLElement>("[data-controller]").forEach(
              disconnectElement,
            );
          }
        }
      }
    }
  });
}

// --- Bootstrap ---

export function start(): void {
  onReady(() => {
    scan(document);
    createObserver().observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
