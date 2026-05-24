import { Context, Env } from "hono";
import { Get, ControllerBase } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";
import { View } from "./views/index";

class ComponentsController<T extends Env> extends ControllerBase<T> {
  override base = "components";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
  }

  @Get("/")
  index({ render }: Context) {
    return render(<View />);
  }
}

export default new ComponentsController();
