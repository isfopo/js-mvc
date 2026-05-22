/**
 * Middleware that unflattens bracket-notation form body keys into nested objects.
 *
 * Stores the result on context as `c.set("parsedBody", ...)` so downstream
 * guards and handlers can reuse it without re-parsing.
 *
 * Register this middleware in src/index.tsx before controllers:
 *   app.use("*", unflattenFormBodyMiddleware());
 */

import type { Context, MiddlewareHandler } from "hono";
import { unflattenFormBody } from "infrastructure/validation/unflatten-form-body";

const PARSED_BODY_KEY = "__parsedBody";

/**
 * Retrieve the pre-unflattened form body from context, if the middleware ran.
 */
export function getParsedBody(c: Context): Record<string, unknown> | undefined {
  return c.get(PARSED_BODY_KEY);
}

export function unflattenFormBodyMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const contentType = c.req.header("content-type") ?? "";

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const raw = await c.req.parseBody();
      const flat = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, v as unknown]),
      );
      c.set(PARSED_BODY_KEY, unflattenFormBody(flat));
    }

    await next();
  };
}
