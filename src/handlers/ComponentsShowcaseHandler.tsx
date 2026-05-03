import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";
import { ComponentsShowcase } from "../views/pages/ComponentsShowcase";

class ComponentsShowcaseHandler<T extends Env> extends HandlerBase<T> {
  override base = "";

  @Get("/components")
  index({ render }: Context) {
    return render(<ComponentsShowcase />);
  }
}

export default new ComponentsShowcaseHandler();
