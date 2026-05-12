import type { ValidationResult, IValidatable } from "../../../../infrastructure/validation/IValidatable";

export class VoteRequest implements IValidatable {
  readonly choice: string;
  readonly reason: string;

  constructor(body: Record<string, unknown>) {
    this.choice = String(body.choice ?? "");
    this.reason = String(body.reason ?? "");
  }

  validate(): ValidationResult {
    const errors: Record<string, string> = {};
    const valid = ["approve", "abstain", "block"];

    if (!valid.includes(this.choice)) {
      errors.choice = "Must be approve, abstain, or block";
    }
    if (this.choice === "block" && !this.reason.trim()) {
      errors.reason = "Blocking requires a reason";
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }
}
