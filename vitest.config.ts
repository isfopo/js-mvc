import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const src = resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: {
      api: resolve(src, "api"),
      db: resolve(src, "db"),
      infrastructure: resolve(src, "infrastructure"),
      middlewares: resolve(src, "middlewares"),
      utils: resolve(src, "utils"),
      views: resolve(src, "views"),
    },
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          GITHUB_CLIENT_ID: "test-client-id",
          GITHUB_CLIENT_SECRET: "test-client-secret",
        },
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
