import { Hono } from "hono";
import { registerControllers } from "./infrastructure/controllers";
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
        if (!env.tenet_db) {
          console.error("DB binding is not available. Available keys:", Object.keys(env));
          return;
        }
        try {
          await initDatabase(env.tenet_db as D1Database);
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

registerControllers(app);

// Redirect root to /tenets
app.get("/", (c) => c.redirect("/tenets"));

export default app;
