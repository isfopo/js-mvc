/**
 * DOM dispatcher — the client-side "router".
 *
 * Scans the DOM for [data-controller] elements, instantiates the
 * matching handler class, and wires up actions declared via
 * data-action="{event}->{handler}#{method}".
 *
 * Inspired by Stimulus, but zero-dependency and project-specific.
 */

import type { ActionDescriptor, Handler, HandlerConstructor } from "./types";
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

const activeHandlers = new WeakMap<HTMLElement, Handler[]>();

// --- Wiring ---

function connectElement(element: HTMLElement): void {
  const names = (element.getAttribute("data-controller") ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const handlers: Handler[] = [];

  for (const name of names) {
    const Ctor = registry.get(name);
    if (!Ctor) {
      console.warn(`[dispatcher] No handler registered for "${name}"`);
      continue;
    }

    const instance = new Ctor(element);
    handlers.push(instance);

    // Wire up data-action attributes within this handler's scope.
    // The element itself is checked too, supporting Trigger-only usage
    // where data-controller and data-action live on the same element.

    function wireAction(target: HTMLElement, raw: string) {
      for (const part of raw.split(";")) {
        const desc = parseAction(part);
        if (desc && desc.handler === name) {
          const fn = (instance as any)[desc.method];
          if (typeof fn === "function") {
            target.addEventListener(desc.event, fn.bind(instance));
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

    instance.connect();
  }

  if (handlers.length > 0) {
    activeHandlers.set(element, handlers);
  }
}

function disconnectElement(element: HTMLElement): void {
  const handlers = activeHandlers.get(element);
  if (handlers) {
    for (const h of handlers) {
      h.disconnect();
    }
    activeHandlers.delete(element);
  }
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
