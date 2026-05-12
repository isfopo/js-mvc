import { Hono } from "hono";

import HomeController from "../../pages/Home/controller";
import ComponentsController from "../../pages/Components/controller";
import TenetsController from "../../pages/Tenets/controller";
import TenetsApiController from "../../api/Tenets/controller";
import WellKnownController from "../../api/WellKnown/controller";
import AuthController from "../../api/Auth/controller";

import { initDatabase } from "./infrastructure/db/init";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Run DB schema initialization once on first request
let initialized = false;
let initPromise: Promise<void> | null = null;
app.use("*", async (c, next) => {
  if (!initialized) {
    if (!initPromise) {
      initPromise = (async () => {
        const env = c.env as unknown as Record<string, unknown>;
        if (!env.DB) {
          console.error(
            "DB binding is not available. Available keys:",
            Object.keys(env),
          );
          return;
        }
        try {
          await initDatabase(env.DB as D1Database);
          initialized = true;
          console.log("Database initialized");
        } catch (e) {
          console.error("Database init failed:", e);
        }
      })();
    }
    await initPromise;
  }
  await next();
});

HomeController.register(app);
ComponentsController.register(app);
TenetsController.register(app);
TenetsApiController.register(app);
WellKnownController.register(app);
AuthController.register(app);

// Redirect root to /tenets
app.get("/", (c) => c.redirect("/tenets"));

export default app;
