/**
 * Vote handler — handles approve/abstain/block button clicks.
 *
 * For "block", prompts for a reason before submitting the form.
 */

import { BaseHandler } from "../../infrastructure/client/BaseHandler";
import { register } from "../../infrastructure/client/dispatcher";

export class VoteHandler extends BaseHandler {
  static override readonly handlerName = "vote";

  override connect(): void {
    // Actions are wired by the dispatcher via data-action attributes
  }

  submit(event: Event): void {
    const target = event.currentTarget as HTMLElement;
    const choice = target.getAttribute("data-vote-choice");
    const form = this.element.closest("form") as HTMLFormElement | null;
    if (!form || !choice) return;

    if (choice === "block") {
      const reason = prompt("Why are you blocking this tenet?");
      if (!reason) {
        event.preventDefault();
        return;
      }
      (form.querySelector("[name=reason]") as HTMLInputElement).value = reason;
    }

    (form.querySelector("[name=choice]") as HTMLInputElement).value = choice;
    form.requestSubmit();
  }
}

register("vote", VoteHandler);
