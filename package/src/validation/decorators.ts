import type { Context } from "hono";

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

/** Contract for a guard that loads an entity into the request context. */
export interface IExistable {
  key: string;
  load(c: Context): Promise<unknown>;
}

/** Contract for a guard that rejects unauthorized requests by throwing. */
export interface IAuthorizable {
  authorize(c: Context): Promise<void> | void;
}

export interface ExistsGuard {
  type: "exists";
  handlerName: string;
  GuardClass: new () => IExistable;
}

export interface AuthorizeGuard {
  type: "authorize";
  handlerName: string;
  GuardClass: new () => IAuthorizable;
}

export interface ValidateGuard {
  type: "validate";
  handlerName: string;
  RequestClass: new (body: Record<string, unknown>) => IValidatable;
}

export type GuardDescriptor =
  | ExistsGuard
  | AuthorizeGuard
  | ValidateGuard;

/** Shared metadata key used by decorators and ControllerBase. */
export const GUARDS_KEY = Symbol("hono:guards");

type MethodDecoratorFactory = <This>(
  target: (this: This, ...args: any[]) => any,
  context: ClassMethodDecoratorContext<This>,
) => void;

function guardDecorator(
  createGuard: (handlerName: string) => GuardDescriptor,
): MethodDecoratorFactory {
  return (_target, context) => {
    const metadata = context.metadata as Record<PropertyKey, unknown>;
    const guards = (metadata[GUARDS_KEY] ??= []) as GuardDescriptor[];
    guards.push(createGuard(String(context.name)));
  };
}

/** Register an entity loader guard. */
export function Exists(
  GuardClass: new () => IExistable,
): MethodDecoratorFactory {
  return guardDecorator((handlerName) => ({
    type: "exists",
    handlerName,
    GuardClass,
  }));
}

/** Register an authorization guard. */
export function Authorize(
  GuardClass: new () => IAuthorizable,
): MethodDecoratorFactory {
  return guardDecorator((handlerName) => ({
    type: "authorize",
    handlerName,
    GuardClass,
  }));
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
