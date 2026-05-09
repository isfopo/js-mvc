/**
 * Dismiss handler — hides or removes an element on a trigger event.
 *
 * Useful for dismissible alerts, banners, toasts, modals.
 *
 * Usage:
 *   <div data-controller="dismiss" role="alert">
 *     <span>Something happened.</span>
 *     <button data-action="click->dismiss#hide">✕</button>
 *   </div>
 *
 * By default the root element is hidden. Set data-dismiss-remove="true"
 * to remove the element from the DOM instead.
 */

import { BaseHandler } from "./BaseHandler";
import { register } from "../dispatcher";

export class DismissHandler extends BaseHandler {
  static override readonly handlerName = "dismiss";

  override connect(): void {
    // no-op — actions are wired by the dispatcher
  }

  /** Hide the handler's root element */
  hide(): void {
    const shouldRemove = this.data("remove") === "true";
    if (shouldRemove) {
      this.element.remove();
    } else {
      this.element.style.display = "none";
    }
  }
}

register("dismiss", DismissHandler);
