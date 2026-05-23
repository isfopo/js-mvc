/* ------------------------------------------------------------------ */
/*  Stage 3 Decorators & Metadata                                      */
/*                                                                     */
/*  Uses the TC39 decorator proposal (Stage 3) with the companion      */
/*  decorator-metadata proposal.                                       */
/*    https://github.com/tc39/proposal-decorators                      */
/*    https://github.com/tc39/proposal-decorator-metadata              */
/*                                                                     */
/*  We store route descriptors in `context.metadata` so every          */
/*  decorator on the same class shares the same object, and later      */
/*  read them back via `Constructor[Symbol.metadata]`.                 */
/*                                                                     */
/*  At build time esbuild transpiles the decorators down to runtime    */
/*  helpers (the vite config sets `esbuild.target: "es2022"`).         */
/*                                                                     */
/*  Since `Symbol.metadata` is not yet available in every runtime      */
/*  (including Cloudflare Workers / workerd) we define it here as      */
/*  a polyfill if it is missing.                                       */
/* ------------------------------------------------------------------ */

import { Context, Env, Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "./errors/index";
import type { GuardDescriptor } from "./validation/GuardDescriptor";
import { executeGuard } from "./validation/guard-executor";
import { GUARDS_KEY } from "./validation/decorators";

/* ---------- Symbol.metadata polyfill ---------- */

if (typeof Symbol !== "undefined" && !Symbol.metadata) {
  (Symbol as { metadata: symbol }).metadata = Symbol("Symbol.metadata");
}

/* ---------- Route descriptor types ---------- */

export interface RouteDescriptor {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  handlerName: string;
}

/** Well-known key used to store routes inside the decorator metadata. */
const ROUTES_KEY = Symbol("hono:routes");

/* ---------- Decorator factory ---------- */

function httpRoute(method: string, path: string) {
  return function <This>(
    _target: (this: This, ...args: any[]) => any,
    context: ClassMethodDecoratorContext<This>,
  ): void {
    const routes: RouteDescriptor[] = (((context.metadata as any)[
      ROUTES_KEY
    ] as RouteDescriptor[]) ??= []);
    routes.push({
      method: method as RouteDescriptor["method"],
      path,
      handlerName: String(context.name),
    });
  };
}

/* ---------- Exported decorators ---------- */

export const Get = (path: string) => httpRoute("get", path);
export const Post = (path: string) => httpRoute("post", path);
export const Put = (path: string) => httpRoute("put", path);
export const Delete = (path: string) => httpRoute("delete", path);
export const Patch = (path: string) => httpRoute("patch", path);

/* ---------- Controller base class ---------- */

export abstract class ControllerBase<T extends Env> {
  _app: Hono<T>;
  abstract base: string;

  constructor() {
    this._app = new Hono();
  }

  /** Register every collected route on the parent Hono application. */
  register<E extends Env>(app: Hono<E>): void {
    /* Read the route table that the decorators wrote to the shared
       metadata object.  After esbuild has finished transpiling,
       `Constructor[Symbol.metadata]` points to the same object that
       was passed as `context.metadata` to every decorator on this
       class. */
    const metadata = (this.constructor as any)[Symbol.metadata];
    const routes: RouteDescriptor[] = metadata?.[ROUTES_KEY] ?? [];
    const guards: GuardDescriptor[] = metadata?.[GUARDS_KEY] ?? [];

    /* Attach a renderer that wraps every response in the shared layout.
       This is inherited by all routes registered below. */
    this._app.use("*", async (c, next) => {
      c.setRenderer((content: any) => {
        const user = (c as any).get("user");
        const doctype = "<!DOCTYPE html>";
        const body = renderToString(
          <Layout user={user} currentPath={c.req.path}>
            {content}
          </Layout>,
        );
        return c.html(doctype + body);
      });
      await next();
    });

    /* Wire each route to the matching handler on this controller. */
    for (const route of routes) {
      const handlerGuards = guards.filter(
        (g) => g.handlerName === route.handlerName,
      );

      this._app[route.method](route.path, async (c: Context) => {
        try {
          /* Execute guards in declaration order before the handler. */
          for (const guard of handlerGuards) {
            await executeGuard(guard, c);
          }
          return (this as any)[route.handlerName](c);
        } catch (error: unknown) {
          return handleError(c, error);
        }
      });
    }

    app.route(this.base, this._app);
  }
}
