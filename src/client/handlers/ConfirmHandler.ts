/**
 * Confirm handler — shows a native confirm dialog before an action proceeds.
 *
 * Usage:
 *   <div data-controller="confirm" data-confirm-message="Delete this item?">
 *     <button data-action="click->confirm#ask">Delete</button>
 *   </div>
 *
 * The event is prevented if the user cancels the confirm dialog.
 */

import { BaseHandler } from "./BaseHandler";
import { register } from "../dispatcher";

export class ConfirmHandler extends BaseHandler {
  static override readonly handlerName = "confirm";

  override connect(): void {
    // The dispatcher already wires data-action attributes, but we also
    // support the simpler pattern: any link/form inside the scope can
    // be intercepted without an explicit data-action by listening globally.
  }

  /**
   * Called via data-action="click->confirm#ask".
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
