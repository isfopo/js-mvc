/**
 * Confirm handler — shows a native confirm dialog before an action proceeds.
 *
 * Usage with Action component (Trigger-only, recommended):
 *   const Confirm = Action("confirm");
 *
 *   <Confirm.Trigger event="click" method="ask" message="Delete this item?">
 *     <button>Delete</button>
 *   </Confirm.Trigger>
 *
 * The event is prevented if the user cancels the confirm dialog.
 */

import { BaseHandler } from "../infrastructure/client/BaseHandler";
import { register } from "../infrastructure/client/dispatcher";

export class ConfirmHandler extends BaseHandler {
  static override readonly handlerName = "confirm";

  override connect(): void {
    // The dispatcher already wires data-action attributes, but we also
    // support the simpler pattern: any link/form inside the scope can
    // be intercepted without an explicit data-action by listening globally.
  }

  /**
   * Called when the trigger element's event fires.
   * Stops the default behavior unless the user confirms.
   */
  ask(event: Event): void {
    const message = this.data("message") ?? "Are you sure?";
    if (!confirm(message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

register("confirm", ConfirmHandler);
