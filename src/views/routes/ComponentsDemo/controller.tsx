import { Context, Env } from "hono";
import { Get, ControllerBase } from "infrastructure/ControllerBase";
import { View } from "./views/index";

class ComponentsController<T extends Env> extends ControllerBase<T> {
  override base = "components";

  @Get("/")
  index({ render }: Context) {
    return render(<View />);
  }
}

export default new ComponentsController();
