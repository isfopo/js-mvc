import type { Context } from "hono";
import { NotFoundError, ValidationError } from "../errors";
import type { GuardDescriptor } from "./decorators";
import { parseRequestBody } from "./parseBody";

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
export async function executeGuard(guard: GuardDescriptor, c: Context): Promise<void> {
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
