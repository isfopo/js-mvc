/**
 * Status transition handler — confirms before changing tenet status.
 */

import { BaseHandler } from "infrastructure/client/BaseHandler";
import { register } from "infrastructure/client/dispatcher";

export class StatusTransitionHandler extends BaseHandler {
  static override readonly handlerName = "status";

  override connect(): void {
    // Actions are wired by the dispatcher via data-action attributes
  }

  transition(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const status = target.getAttribute("data-status-target");
    const message = target.getAttribute("data-status-message") ?? "Change status?";

    if (!confirm(message)) {
      event.preventDefault();
      return;
    }

    const form = this.element.closest("form") as HTMLFormElement | null;
    if (!form || !status) return;

    (form.querySelector("[name=status]") as HTMLInputElement).value = status;
    form.requestSubmit();
  }
}

register("status", StatusTransitionHandler);
