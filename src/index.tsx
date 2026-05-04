import { Hono } from "hono";
import { registerHandlers } from "./handlers";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

registerHandlers(app);

// Redirect root to /home
app.get("/", (c) => c.redirect("/home"));

export default app;
