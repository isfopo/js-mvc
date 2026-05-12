var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/infrastructure/client/BaseHandler.ts
var BaseHandler = class {
  constructor(element) {
    /** The root element that declared data-controller */
    __publicField(this, "element");
    this.element = element;
  }
  /** Called when the element is removed from the DOM (cleanup) */
  disconnect() {
  }
  // --- Helpers ---
  /**
   * Find a single target element within the handler's scope.
   * Targets are declared as data-{handler}-target="{name}" on child elements.
   *
   * Example: <input data-confirm-target="input" />  →  this.target("input")
   */
  target(name) {
    const attr = `data-${this.handlerName}-target`;
    return this.element.querySelector(`[${attr}="${name}"]`);
  }
  /**
   * Find all target elements within the handler's scope.
   */
  targets(name) {
    const attr = `data-${this.handlerName}-target`;
    return this.element.querySelectorAll(`[${attr}="${name}"]`);
  }
  /**
   * Read a configuration value from data-{handler}-{key} on the root element.
   *
   * Example: <div data-controller="confirm" data-confirm-message="Sure?">
   *          →  this.data("message")  // "Sure?"
   */
  data(key) {
    return this.element.getAttribute(`data-${this.handlerName}-${key}`);
  }
  /** Convenience: shorthand for this.constructor.handlerName */
  get handlerName() {
    return this.constructor.handlerName;
  }
};
/** Static handler name — override in subclasses */
__publicField(BaseHandler, "handlerName", "");

// src/infrastructure/client/dispatcher.ts
var registry = /* @__PURE__ */ new Map();
function register(name, ctor) {
  registry.set(name, ctor);
}
var ACTION_RE = /^(\w+)-\s*>\s*(\w+)#(\w+)$/;
function parseAction(raw) {
  const m = raw.trim().match(ACTION_RE);
  if (!m) return null;
  return { event: m[1], handler: m[2], method: m[3] };
}
var activeHandlers = /* @__PURE__ */ new WeakMap();
function connectElement(element) {
  const names = (element.getAttribute("data-controller") ?? "").split(/\s+/).filter(Boolean);
  const handlers = [];
  for (const name of names) {
    let wireAction2 = function(target, raw) {
      for (const part of raw.split(";")) {
        const desc = parseAction(part);
        if (desc && desc.handler === name) {
          const fn = instance[desc.method];
          if (typeof fn === "function") {
            target.addEventListener(desc.event, fn.bind(instance));
          } else {
            console.warn(
              `[dispatcher] Handler "${name}" has no method "${desc.method}"`
            );
          }
        }
      }
    };
    var wireAction = wireAction2;
    const Ctor = registry.get(name);
    if (!Ctor) {
      console.warn(`[dispatcher] No handler registered for "${name}"`);
      continue;
    }
    const instance = new Ctor(element);
    handlers.push(instance);
    const selfAction = element.getAttribute("data-action");
    if (selfAction) wireAction2(element, selfAction);
    element.querySelectorAll("[data-action]").forEach((target) => wireAction2(target, target.getAttribute("data-action") ?? ""));
    instance.connect();
  }
  if (handlers.length > 0) {
    activeHandlers.set(element, handlers);
  }
}
function disconnectElement(element) {
  const handlers = activeHandlers.get(element);
  if (handlers) {
    for (const h of handlers) {
      h.disconnect();
    }
    activeHandlers.delete(element);
  }
}
function scan(root) {
  root.querySelectorAll("[data-controller]").forEach(connectElement);
}
function createObserver() {
  return new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          if (el.hasAttribute?.("data-controller")) {
            connectElement(el);
          }
          if (el.querySelectorAll) {
            el.querySelectorAll("[data-controller]").forEach(
              connectElement
            );
          }
        }
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          disconnectElement(el);
          if (el.querySelectorAll) {
            el.querySelectorAll("[data-controller]").forEach(
              disconnectElement
            );
          }
        }
      }
    }
  });
}
function start() {
  onReady(() => {
    scan(document);
    createObserver().observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// src/handlers/DismissHandler.ts
var DismissHandler = class extends BaseHandler {
  connect() {
  }
  /** Hide the handler's root element */
  hide() {
    const shouldRemove = this.data("remove") === "true";
    if (shouldRemove) {
      this.element.remove();
    } else {
      this.element.style.display = "none";
    }
  }
};
__publicField(DismissHandler, "handlerName", "dismiss");
register("dismiss", DismissHandler);

// src/handlers/ConfirmHandler.ts
var ConfirmHandler = class extends BaseHandler {
  connect() {
  }
  /**
   * Called when the trigger element's event fires.
   * Stops the default behavior unless the user confirms.
   */
  ask(event) {
    const message = this.data("message") ?? "Are you sure?";
    if (!confirm(message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
};
__publicField(ConfirmHandler, "handlerName", "confirm");
register("confirm", ConfirmHandler);

// src/handlers/VoteHandler.ts
var VoteHandler = class extends BaseHandler {
  connect() {
  }
  submit(event) {
    const target = event.currentTarget;
    const choice = target.getAttribute("data-vote-choice");
    const form = this.element.closest("form");
    if (!form || !choice) return;
    if (choice === "block") {
      const reason = prompt("Why are you blocking this tenet?");
      if (!reason) {
        event.preventDefault();
        return;
      }
      form.querySelector("[name=reason]").value = reason;
    }
    form.querySelector("[name=choice]").value = choice;
    form.requestSubmit();
  }
};
__publicField(VoteHandler, "handlerName", "vote");
register("vote", VoteHandler);

// src/handlers/StatusTransitionHandler.ts
var StatusTransitionHandler = class extends BaseHandler {
  connect() {
  }
  transition(event) {
    const target = event.currentTarget;
    const status = target.getAttribute("data-status-target");
    const message = target.getAttribute("data-status-message") ?? "Change status?";
    if (!confirm(message)) {
      event.preventDefault();
      return;
    }
    const form = this.element.closest("form");
    if (!form || !status) return;
    form.querySelector("[name=status]").value = status;
    form.requestSubmit();
  }
};
__publicField(StatusTransitionHandler, "handlerName", "status");
register("status", StatusTransitionHandler);

// src/handlers/AddOptionHandler.ts
var AddOptionHandler = class extends BaseHandler {
  constructor() {
    super(...arguments);
    __publicField(this, "counter", 1);
  }
  // template has index 0, so start at 1
  connect() {
    const start2 = this.data("start");
    if (start2) this.counter = parseInt(start2, 10);
  }
  add() {
    const template = this.element.querySelector("template");
    const container = this.element.querySelector("[data-option-container]");
    if (!template || !container) return;
    let raw = template.innerHTML.replace(/__IDX__/g, String(this.counter));
    raw = raw.replace(/__IDX_PLUS_ONE__/g, String(this.counter + 1));
    container.insertAdjacentHTML("beforeend", raw);
    this.counter++;
  }
};
__publicField(AddOptionHandler, "handlerName", "addoption");
register("addoption", AddOptionHandler);

// src/infrastructure/client/main.ts
console.log("js-mvc client loaded");
function onReady(cb) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb);
  } else {
    cb();
  }
}
start();
export {
  onReady
};
//# sourceMappingURL=main.js.map
