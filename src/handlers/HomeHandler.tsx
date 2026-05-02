import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";
import { Home } from "../views/pages/Home";
import { Layout } from "../views/shared/Layout";

class HomeHandler<T extends Env> extends HandlerBase<T> {
  override base = "home";

  @Get("/")
  index({ html }: Context) {
    return html(
      <Layout>
        <Home today={new Date()} />
      </Layout>,
    );
  }

  @Get("/about")
  about({ html }: Context) {
    return html(
      <Layout>
        <p>About page</p>
      </Layout>,
    );
  }

  @Get("/items/:id")
  item({ req, html }: Context) {
    const id = req.param("id");
    return html(
      <Layout>
        <p>Viewing item {id}</p>
      </Layout>,
    );
  }
}

export default new HomeHandler();
