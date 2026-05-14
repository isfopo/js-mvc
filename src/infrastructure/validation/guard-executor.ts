import type { Context } from "hono";
import { NotFoundError, ValidationError } from "infrastructure/errors/index";
import type { GuardDescriptor } from "./GuardDescriptor";
import type { IValidatable } from "./IValidatable";

/**
 * Execute a single guard against the current request context.
 *
 * - `exists`   → calls the loader, throws NotFoundError if null, stores on context
 * - `authorize` → calls the check function (should throw on failure)
 * - `validate`  → parses body, constructs IValidatable, runs validate(), stores on context
 *
 * Called by ControllerBase.register() before each route handler.
 */
export async function executeGuard(guard: GuardDescriptor, c: Context): Promise<void> {
  switch (guard.type) {
    case "exists": {
      const entity = await guard.load(c);
      if (entity == null) throw new NotFoundError();
      c.set(guard.key, entity);
      break;
    }

    case "authorize": {
      await guard.check(c);
      break;
    }

    case "validate": {
      const contentType = c.req.header("content-type") ?? "";
      let body: Record<string, unknown>;

      if (contentType.includes("application/json")) {
        body = await c.req.json<Record<string, unknown>>();
      } else {
        // Form-encoded (from HTML <form> submissions)
        const raw = await c.req.parseBody();
        body = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, v as unknown]),
        );
      }

      const instance = new guard.RequestClass(body);
      const result = await instance.validate();

      if (!result.valid) {
        throw new ValidationError("Invalid input", result.errors);
      }

      c.set("validated", instance);
      break;
    }
  }
}
