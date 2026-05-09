import { Hono } from "hono";
import { registerControllers } from "./infrastructure/controllers";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

registerControllers(app);

// Redirect root to /home
app.get("/", (c) => c.redirect("/home"));

export default app;
