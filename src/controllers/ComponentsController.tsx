import { Context, Env } from "hono";
import { Get, ControllerBase } from "./ControllerBase";
import { Components } from "../views/pages/Components";

class ComponentsController<T extends Env> extends ControllerBase<T> {
  override base = "components";

  @Get("/")
  index({ render }: Context) {
    return render(<Components />);
  }
}

export default new ComponentsController();
