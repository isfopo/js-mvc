import process from "node:process";
import crypto from "node:crypto";
import { Context, Env } from "hono";
import { Get, ControllerBase } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";

class WellKnownController<T extends Env> extends ControllerBase<T> {
  override base = ".well-known";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
  }

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
