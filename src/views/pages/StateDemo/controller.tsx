import { Context, Env } from "hono";
import { Get, ControllerBase } from "infrastructure/ControllerBase";
import { viewBuilder } from "./view-builder";
import { View } from "./views/index";

class StateDemoController<T extends Env> extends ControllerBase<T> {
  override base = "_demo/state";

  @Get("/")
  index({ render }: Context) {
    return render(<View {...viewBuilder.index()} />);
  }
}

export default new StateDemoController();
