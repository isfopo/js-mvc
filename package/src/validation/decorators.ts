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

/** Register an entity loader guard. Supports both class and legacy callback forms. */
export function Exists(GuardClass: new () => IExistable): MethodDecoratorFactory;
export function Exists(
  key: string,
  load: (c: Context) => Promise<unknown> | unknown,
): MethodDecoratorFactory;
export function Exists(
  guardOrKey: new () => IExistable | string,
  legacyLoad?: (c: Context) => Promise<unknown> | unknown,
): MethodDecoratorFactory {
  if (typeof guardOrKey === "string") {
    if (!legacyLoad) throw new TypeError("Exists requires a loader");
    const key = guardOrKey;
    return guardDecorator((handlerName) => ({
      type: "exists",
      handlerName,
      GuardClass: class implements IExistable {
        load(c: Context) {
          return Promise.resolve(legacyLoad!(c));
        }
        key = key;
      },
    }));
  }

  return guardDecorator((handlerName) => ({
    type: "exists",
    handlerName,
    GuardClass: guardOrKey,
  }));
}

/** Register an authorization guard. Supports both class and legacy callback forms. */
export function Authorize(GuardClass: new () => IAuthorizable): MethodDecoratorFactory;
export function Authorize(
  check: (c: Context) => Promise<void> | void,
): MethodDecoratorFactory;
export function Authorize(
  guardOrCheck: new () => IAuthorizable | ((c: Context) => Promise<void> | void),
): MethodDecoratorFactory {
  if (typeof guardOrCheck === "function" && !guardOrCheck.prototype?.authorize) {
    const check = guardOrCheck;
    return guardDecorator((handlerName) => ({
      type: "authorize",
      handlerName,
      GuardClass: class implements IAuthorizable {
        authorize(c: Context) {
          return check(c);
        }
      },
    }));
  }

  return guardDecorator((handlerName) => ({
    type: "authorize",
    handlerName,
    GuardClass: guardOrCheck as new () => IAuthorizable,
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
