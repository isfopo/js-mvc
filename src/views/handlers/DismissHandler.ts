/**
 * Dismiss handler — hides or removes an element on a trigger event.
 *
 * Useful for dismissible alerts, banners, toasts, modals.
 *
 * Usage with Action component (Wrapper + Trigger):
 *   const Dismiss = Action("dismiss");
 *
 *   <Dismiss role="alert">
 *     <span>Something happened.</span>
 *     <Dismiss.Trigger event="click" method="hide">
 *       <button>✕</button>
 *     </Dismiss.Trigger>
 *   </Dismiss>
 *
 * The controller is on the Wrapper because hide() hides the container
 * element itself (this.element). Set data-dismiss-remove="true" via
 * Trigger to remove the element from the DOM instead:
 *   <Dismiss.Trigger event="click" method="hide" remove="true">
 *     <button>✕</button>
 *   </Dismiss.Trigger>
 */

import { BaseHandler } from "js-mvc/client/BaseHandler";
import { register } from "js-mvc/client/dispatcher";

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
