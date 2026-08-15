import { TenetStatus } from "data/tenet/model";
import type {
  ValidationResult,
  IValidatable,
} from "js-mvc/validation/decorators";

export class TransitionRequest implements IValidatable {
  readonly status: TenetStatus;
  constructor(body: Record<string, unknown>) {
    this.status = body.status as TenetStatus;
  }

  validate(): ValidationResult {
    return { valid: true, errors: {} };
  }
}
