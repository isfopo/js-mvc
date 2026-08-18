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
