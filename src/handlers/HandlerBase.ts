import { Env, Hono } from "hono";

export abstract class HandlerBase<T extends Env> {
  _app: Hono<T>;
  abstract base: string;

  constructor() {
    this._app = new Hono();
  }

  register<T extends Env>(app: Hono<T>) {
    app.route(this.base, this._app);
  }
}
