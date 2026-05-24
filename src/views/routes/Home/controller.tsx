import { Context, Env } from "hono";
import { Get, ControllerBase } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";
import { viewBuilder } from "./view-builder";
import { View as HomeView } from "./views/index";

class HomeController<T extends Env> extends ControllerBase<T> {
  override base = "home";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
  }

  @Get("/")
  index({ render }: Context) {
    return render(<HomeView {...viewBuilder.index()} />);
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

export default new HomeController();
