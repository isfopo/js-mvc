import type { ValidationResult, IValidatable } from "../../infrastructure/validation/IValidatable";

export interface OptionInput {
  title: string;
  description?: string;
  pros?: string;
  cons?: string;
}

export class ProposeTenetRequest implements IValidatable {
  readonly title: string;
  readonly context: string;
  readonly options: OptionInput[];

  constructor(body: Record<string, unknown>) {
    this.title = (body.title as string) ?? "";
    this.context = (body.context as string) ?? "";

    const raw = body.options;
    this.options = Array.isArray(raw)
      ? raw.map((o: Record<string, unknown>) => ({
          title: String(o.title ?? ""),
          description: o.description != null ? String(o.description) : undefined,
          pros: o.pros != null ? String(o.pros) : undefined,
          cons: o.cons != null ? String(o.cons) : undefined,
        }))
      : [];
  }

  validate(): ValidationResult {
    const errors: Record<string, string> = {};

    if (!this.title.trim()) errors.title = "Title is required";
    if (!this.context.trim()) errors.context = "Context is required";
    if (this.options.length === 0) {
      errors.options = "At least one option is required";
    }
    for (let i = 0; i < this.options.length; i++) {
      if (!this.options[i].title.trim()) {
        errors[`options.${i}.title`] = `Option ${i + 1} title is required`;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }
}
