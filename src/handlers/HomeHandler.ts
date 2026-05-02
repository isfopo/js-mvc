import { Env } from "hono";
import { HandlerBase } from "./HandlerBase";

class HomeHandler<T extends Env> extends HandlerBase<T> {
  override base = "home";
}

export default new HomeHandler();
