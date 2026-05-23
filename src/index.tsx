import { Hono } from "hono";

import HomeController from "views/routes/Home/controller";
import ComponentsController from "views/routes/ComponentsDemo/controller";
import TenetsController from "views/routes/Tenets/controller";
import TenetsApiController from "api/Tenets/controller.api";
import WellKnownController from "views/routes/WellKnown/controller";
import AuthController from "views/pages/Auth/controller";

import { initDatabase } from "infrastructure/QueryLoader";
import { unflattenFormBodyMiddleware } from "infrastructure/middlewares/unflatten-form-body";

import schemaSql from "db/init.sql?raw";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Unflatten bracket-notation form body keys (e.g. options[0][title] → nested objects)
app.use("*", unflattenFormBodyMiddleware());

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
          await initDatabase(env.DB as D1Database, schemaSql);
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
