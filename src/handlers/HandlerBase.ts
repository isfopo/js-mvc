import "reflect-metadata";
import { Context, Env, Hono } from "hono";

const ROUTE_META_KEY = Symbol("routes");

interface RouteDescriptor {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  handlerName: string;
}

function httpRoute(method: string, path: string) {
  return (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const routes: RouteDescriptor[] =
      Reflect.getMetadata(ROUTE_META_KEY, target.constructor) ?? [];
    routes.push({
      method: method as RouteDescriptor["method"],
      path,
      handlerName: propertyKey,
    });
    Reflect.defineMetadata(ROUTE_META_KEY, routes, target.constructor);
    return descriptor;
  };
}

export const Get = (path: string) => httpRoute("get", path);
export const Post = (path: string) => httpRoute("post", path);
export const Put = (path: string) => httpRoute("put", path);
export const Delete = (path: string) => httpRoute("delete", path);
export const Patch = (path: string) => httpRoute("patch", path);

export abstract class HandlerBase<T extends Env> {
  _app: Hono<T>;
  abstract base: string;

  constructor() {
    this._app = new Hono();
  }

  register<T extends Env>(app: Hono<T>) {
    const routes: RouteDescriptor[] =
      Reflect.getMetadata(ROUTE_META_KEY, (this as any).constructor) ?? [];

    for (const route of routes) {
      this._app[route.method](route.path, (c: Context) =>
        (this as any)[route.handlerName](c),
      );
    }

    app.route(this.base, this._app);
  }
}
