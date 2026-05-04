import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";
import { Components } from "../views/pages/Components";

class ComponentsHandler<T extends Env> extends HandlerBase<T> {
  override base = "components";

  @Get("/")
  index({ render }: Context) {
    return render(<Components />);
  }
}

export default new ComponentsHandler();
