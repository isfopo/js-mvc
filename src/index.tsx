import { Hono } from "hono";

import HomeController from "views/pages/Home/controller";
import ComponentsController from "views/pages/ComponentsDemo/controller";
import TenetsController from "views/pages/Tenets/controller";
import TenetsApiController from "api/Tenets/controller";
import WellKnownController from "api/WellKnown/controller";
import AuthController from "api/Auth/controller";

import { initDatabase } from "infrastructure/QueryLoader";
import { frameMiddleware } from "infrastructure/frameMiddleware";

import schemaSql from "db/init.sql?raw";

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
          await initDatabase(env.DB as D1Database, schemaSql);
          initialized = true;
          console.log("Database initialized");
        } catch (e) {
          console.error("Database init failed:", e);
          initPromise = null; // Allow retry on next request
        }
      })();
    }
    await initPromise;
  }
  await next();
});

// Extract frame depth from query string
app.use("*", frameMiddleware);

HomeController.register(app);
ComponentsController.register(app);
TenetsController.register(app);
TenetsApiController.register(app);
WellKnownController.register(app);
AuthController.register(app);

// Redirect root to /tenets
app.get("/", (c) => c.redirect("/tenets"));

// Global error handler — catches unhandled exceptions from routes
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.text("Internal Server Error", 500);
});

export default app;
