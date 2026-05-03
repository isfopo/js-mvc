import { Hono } from "hono";
import process from "node:process";
import crypto from "node:crypto";
import { Layout } from "./views/shared/Layout";
import { Home } from "./views/pages/Home";
import { registerHandlers } from "./handlers";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

registerHandlers(app);

// Home route
app.get("/", (c) => {
  return c.html(
    <Layout route="home">
      <Home today={new Date()} />
    </Layout>,
  );
});

// Chrome devtools endpoint
app.get("/.well-known/appspecific/com.chrome.devtools.json", (c) => {
  return c.json({
    workspace: {
      root: process.cwd(),
      uuid: crypto.randomUUID(),
    },
  });
});

export default app;
