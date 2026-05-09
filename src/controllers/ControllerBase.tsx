import "reflect-metadata";
import { Context, Env, Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { Layout } from "../views/shared/Layout";
import { handleError } from "../errors";

const ROUTE_META_KEY = Symbol("routes");

interface RouteDescriptor {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  handlerName: string;
}

function httpRoute(method: string, path: string) {
  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const ctor = target.constructor as Function;
    const routes: RouteDescriptor[] =
      Reflect.getMetadata(ROUTE_META_KEY, ctor) ?? [];
    routes.push({
      method: method as RouteDescriptor["method"],
      path,
      handlerName: propertyKey,
    });
    Reflect.defineMetadata(ROUTE_META_KEY, routes, ctor);
    return descriptor;
  };
}

export const Get = (path: string) => httpRoute("get", path);
export const Post = (path: string) => httpRoute("post", path);
export const Put = (path: string) => httpRoute("put", path);
export const Delete = (path: string) => httpRoute("delete", path);
export const Patch = (path: string) => httpRoute("patch", path);

export abstract class ControllerBase<T extends Env> {
  _app: Hono<T>;
  abstract base: string;

  constructor() {
    this._app = new Hono();
  }

  register<T extends Env>(app: Hono<T>) {
    const routes: RouteDescriptor[] =
      Reflect.getMetadata(ROUTE_META_KEY, (this as any).constructor) ?? [];

    this._app.use("*", async (c, next) => {
      c.setRenderer((content) => {
        const doctype = "<!DOCTYPE html>";
        const body = renderToString(<Layout>{content}</Layout>);
        return c.html(doctype + body);
      });
      await next();
    });

    for (const route of routes) {
      this._app[route.method](route.path, async (c: Context) => {
        try {
          return (this as any)[route.handlerName](c);
        } catch (error: unknown) {
          return handleError(c, error);
        }
      });
    }

    app.route(this.base, this._app);
  }
}
