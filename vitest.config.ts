import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { createSqlTypesPlugin } from "./.vite/plugins";
import { sqlTransformPlugin } from "./package/plugins/index.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const src = resolve(__dirname, "src");
const pkg = resolve(__dirname, "package", "src");

export default defineConfig({
  resolve: {
    alias: {
      api: resolve(src, "api"),
      data: resolve(src, "data"),
      db: resolve(src, "db"),
      "error-handler": resolve(src, "error-handler.tsx"),
      "js-mvc": pkg,
      middlewares: resolve(src, "middlewares"),
      utils: resolve(src, "utils"),
      views: resolve(src, "views"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "hono/jsx",
  },
  plugins: [
    sqlTransformPlugin(),
    createSqlTypesPlugin(),
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
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      ".vite/**/*.test.ts",
      "package/**/*.test.ts",
      "package/**/*.test.tsx",
    ],
  },
});
