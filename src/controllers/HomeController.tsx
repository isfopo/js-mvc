import { Context, Env } from "hono";
import { Get, ControllerBase } from "./ControllerBase";
import { Home } from "../views/pages/Home";
import { HomeService } from "../services/HomeService";

class HomeController<T extends Env> extends ControllerBase<T> {
  override base = "home";
  service = new HomeService();

  constructor() {
    super();
  }

  @Get("/")
  index({ render }: Context) {
    return render(<Home {...this.service.index()} />);
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
