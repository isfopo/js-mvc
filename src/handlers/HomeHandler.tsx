import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";
import { Home } from "../views/pages/Home";

class HomeHandler<T extends Env> extends HandlerBase<T> {
  override base = "home";

  constructor() {
    super();
  }

  @Get("/")
  index({ render }: Context) {
    return render(<Home today={new Date()} />);
  }

  @Get("/about")
  about({ render }: Context) {
    return render(<p>About page</p>);
  }

  @Get("/items/:id")
  item({ req, render }: Context) {
    const id = req.param("id");
    return render(<p>Viewing item {id}</p>);
  }
}

export default new HomeHandler();
