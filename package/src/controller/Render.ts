import type { FC } from "hono/jsx";
import type { MethodDecoratorFactory } from "../gaurds/types";

/**
 * A render descriptor records that a route handler's return value (a plain
 * view-model object) should be rendered inside the declared View component,
 * and that the handler builds that view-model via the paired builder class.
 */
export interface RenderDescriptor {
  handlerName: string;
  view: FC<any>;
  builder: new () => any;
}

/**
 * Shared metadata key used by `@Render` and read back by
 * `ControllerBase.register()`.
 */
export const RENDER_KEY = Symbol("hono:render");

/**
 * Declare which View component should render this handler's view-model, and
 * which view-builder class builds that view-model.
 *
 * The decorated handler builds its view-model via `this.models` (the shared
 * `ViewBuilderBase.instance()` for the declared builder class) and `return`s
 * the plain object. `ControllerBase.register()` wires the route so that, when
 * the handler returns a non-`Response` object, it is rendered inside the
 * declared View — instead of the handler calling `c.render(...)` itself.
 *
 * Routes not decorated with `@Render` (and handlers returning a `Response`
 * such as `c.redirect(...)`) are left untouched.
 *
 * @example
 *   @Get("/")
 *   @Render(IndexView, TenetViewBuilder)
 *   index(c) {
 *     const result = await services.list(c.env.DB);
 *     return this.models.index(result.tenets, user);
 *   }
 */
export function Render(
  view: FC<any>,
  builder: new () => any,
): MethodDecoratorFactory {
  return function <This>(
    _target: (this: This, ...args: any[]) => any,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    const metadata = context.metadata as Record<PropertyKey, unknown>;
    const renders: RenderDescriptor[] = ((metadata[RENDER_KEY] as
      RenderDescriptor[]) ??= []);
    renders.push({ handlerName: String(context.name), view, builder });
  };
}
