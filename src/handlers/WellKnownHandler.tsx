import process from "node:process";
import crypto from "node:crypto";
import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";

class WellKnownHandler<T extends Env> extends HandlerBase<T> {
  override base = ".well-known";

  // Chrome devtools endpoint
  @Get("appspecific/com.chrome.devtools.json")
  chromeDevTools({ json }: Context) {
    return json({
      workspace: {
        root: process.cwd(),
        uuid: crypto.randomUUID(),
      },
    });
  }
}

export default new WellKnownHandler();
