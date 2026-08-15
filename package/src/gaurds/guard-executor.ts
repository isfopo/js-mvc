import type { Context } from "hono";
import { NotFoundError, ValidationError } from "../errors";
import { parseRequestBody } from "../middleware/parseBody";
import type { GuardDescriptor, MethodDecoratorFactory } from "./types";

/** Shared metadata key used by decorators and ControllerBase. */
export const GUARDS_KEY = Symbol("hono:guards");

export function guardDecorator(
  createGuard: (handlerName: string) => GuardDescriptor,
): MethodDecoratorFactory {
  return (_target, context) => {
    const metadata = context.metadata as Record<PropertyKey, unknown>;
    const guards = (metadata[GUARDS_KEY] ??= []) as GuardDescriptor[];
    guards.push(createGuard(String(context.name)));
  };
}

/**
 * Execute a single guard against the current request context.
 *
 * - `exists`   → instantiates the IExistable, calls load(), throws NotFoundError if null, stores on context
 * - `authorize` → instantiates the IAuthorizable, calls authorize() (should throw on failure)
 * - `validate`  → reads the body parsed by the parseBody() middleware,
 *   constructs IValidatable, runs validate(), stores on context
 *
 * Called by ControllerBase.register() before each route handler.
 */
export async function executeGuard(
  guard: GuardDescriptor,
  c: Context,
): Promise<void> {
  switch (guard.type) {
    case "exists": {
      const instance = new guard.GuardClass();
      const entity = await instance.load(c);
      if (entity == null) throw new NotFoundError();
      c.set(instance.key, entity);
      break;
    }

    case "authorize": {
      const instance = new guard.GuardClass();
      await instance.authorize(c);
      break;
    }

    case "validate": {
      const body = parseRequestBody(c);
      const instance = new guard.RequestClass(body);
      const result = await instance.validate();

      if (!result.valid) {
        throw new ValidationError("Invalid input", result.errors);
      }

      c.set("body", instance);
      break;
    }
  }
}
