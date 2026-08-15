import type { Context } from "hono";
import { MethodDecoratorFactory } from "./types";
import { guardDecorator } from "./guard-executor";

/** Contract for a guard that loads an entity into the request context. */
export interface IExistable {
  key: string;
  load(c: Context): Promise<unknown>;
}

export interface ExistsGuard {
  type: "exists";
  handlerName: string;
  GuardClass: new () => IExistable;
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
