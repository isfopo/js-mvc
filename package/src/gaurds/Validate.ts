import { guardDecorator } from "./guard-executor";
import { MethodDecoratorFactory } from "./types";

/** Result returned by a request object's validate() method. */
export interface ValidationResult {
  valid: boolean;
  /** Field-level error messages keyed by field name. */
  errors?: Record<string, string>;
}

/** Contract implemented by request/input objects that validate themselves. */
export interface IValidatable {
  validate(): ValidationResult | Promise<ValidationResult>;
}

export interface ValidateGuard {
  type: "validate";
  handlerName: string;
  RequestClass: new (body: Record<string, unknown>) => IValidatable;
}

/** Register a self-validating request class. */
export function Validate(
  RequestClass: new (body: Record<string, unknown>) => IValidatable,
): MethodDecoratorFactory {
  return guardDecorator((handlerName) => ({
    type: "validate",
    handlerName,
    RequestClass,
  }));
}
