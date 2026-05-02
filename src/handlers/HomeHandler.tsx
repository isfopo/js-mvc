import { Context, Env } from "hono";
import { Get, HandlerBase } from "./HandlerBase";
import { Home } from "../views/pages/Home";
import { Layout } from "../views/shared/Layout";

class HomeHandler<T extends Env> extends HandlerBase<T> {
  override base = "home";

  @Get("/")
  index(_c: Context) {
    return _c.html(
      <Layout>
        <Home today={new Date()} />
      </Layout>,
    );
  }

  @Get("/about")
  about(_c: Context) {
    return _c.html(
      <Layout>
        <p>About page</p>
      </Layout>,
    );
  }

  @Get("/items/:id")
  item(c: Context) {
    const id = c.req.param("id");
    return c.html(
      <Layout>
        <p>Viewing item {id}</p>
      </Layout>,
    );
  }
}

export default new HomeHandler();
