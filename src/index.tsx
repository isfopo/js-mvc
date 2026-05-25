import { Hono } from "hono";

import HomeController from "views/routes/Home/controller";
import TenetsController from "views/routes/Tenets/controller";
import TenetsApiController from "views/routes/Tenets/controller.api";
import WellKnownController from "views/routes/WellKnown/controller";
import AuthController from "views/routes/Auth/controller";

import { initDatabase } from "data/init";
import { seedDatabase } from "data/seed";
import { unflattenFormBodyMiddleware } from "js-mvc/middleware/unflatten-form-body";

import schemaSql from "data/init.sql?raw";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Unflatten bracket-notation form body keys (e.g. options[0][title] → nested objects)
app.use("*", unflattenFormBodyMiddleware());

// Run DB schema initialization once on first request
let initialized = false;
let initFailed = false;
let initPromise: Promise<void> | null = null;
app.use("*", async (c, next) => {
  // If a previous initialization attempt failed, reject all requests
  // rather than serving with an uninitialized database
  if (initFailed) {
    return c.text("Database unavailable — check server logs", 503);
  }

  if (!initialized) {
    if (!initPromise) {
      initPromise = (async () => {
        const env = c.env as unknown as Record<string, unknown>;
        if (!env.DB) {
          console.error(
            "DB binding is not available. Available keys:",
            Object.keys(env),
          );
          initFailed = true;
          return;
        }
        try {
          await initDatabase(env.DB as D1Database, schemaSql);
          if (import.meta.env.DEV) {
            await seedDatabase(env.DB as D1Database);
            console.log("Database seeded");
          }
          initialized = true;
          console.log("Database initialized");
        } catch (e) {
          console.error("Database init failed:", e);
          initFailed = true;
        }
      })();
    }
    await initPromise;

    // Check again after awaiting — init may have failed
    if (initFailed) {
      return c.text("Database unavailable — check server logs", 503);
    }
  }
  await next();
});

HomeController.register(app);
TenetsController.register(app);
TenetsApiController.register(app);
WellKnownController.register(app);
AuthController.register(app);

// Redirect root to /tenets
app.get("/", (c) => c.redirect("/tenets"));

export default app;
