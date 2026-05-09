import process from "node:process";
import crypto from "node:crypto";
import { Context, Env } from "hono";
import { Get, ControllerBase } from "./ControllerBase";

class WellKnownController<T extends Env> extends ControllerBase<T> {
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

export default new WellKnownController();
