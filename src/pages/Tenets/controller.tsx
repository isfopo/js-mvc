import { Context, Env } from "hono";
import { Get, ControllerBase } from "../../infrastructure/ControllerBase";
import { requireAuth } from "../../infrastructure/middlewares/auth";
import { View as IndexView } from "./views/index";

class TenetsController<T extends Env> extends ControllerBase<T> {
  override base = "tenets";

  constructor() {
    super();
    // All routes in this controller require authentication
    this._app.use("*", requireAuth());
  }

  @Get("/")
  index(c: Context) {
    return c.render(<IndexView />);
  }
}

export default new TenetsController();
