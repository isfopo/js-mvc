import type { Context } from "hono";
import { MethodDecoratorFactory } from "./types";
import { guardDecorator } from "./guard-executor";

/** Contract for a guard that rejects unauthorized requests by throwing. */
export interface IAuthorizable {
  authorize(c: Context): Promise<void> | void;
}

export interface AuthorizeGuard {
  type: "authorize";
  handlerName: string;
  GuardClass: new () => IAuthorizable;
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

