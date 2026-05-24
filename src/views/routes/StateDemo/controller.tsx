import { Context, Env } from "hono";
import { Get, ControllerBase } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";
import { viewBuilder } from "./view-builder";
import { View } from "./views/index";

class StateDemoController<T extends Env> extends ControllerBase<T> {
  override base = "_demo/state";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
  }

  @Get("/")
  index({ render }: Context) {
    return render(<View {...viewBuilder.index()} />);
  }
}

export default new StateDemoController();
