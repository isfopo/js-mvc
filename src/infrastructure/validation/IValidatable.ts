/**
 * Result of a single validate() call.
 */
export interface ValidationResult {
  valid: boolean;
  /** Field-level error messages (keyed by field name). */
  errors?: Record<string, string>;
}

/**
 * Interface for request/input objects that perform self-validation.
 *
 * Usage:
 *   class CreateTenetRequest implements IValidatable {
 *     validate() { ... }
 *   }
 */
export interface IValidatable {
  validate(): ValidationResult | Promise<ValidationResult>;
}
