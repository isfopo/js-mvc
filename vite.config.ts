import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import {
  clientBuildPlugin,
  cssBuildPlugin,
  sqlTransformPlugin,
  sqlTypesPlugin,
} from "./package/plugins/index.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const src = resolve(__dirname, "src");
const pkg = resolve(__dirname, "package", "src");

export default defineConfig({
  resolve: {
    alias: {
      // Top-level src/ directories — enables bare imports like "db/init"
      api: resolve(src, "api"),
      data: resolve(src, "data"),
      "error-handler": resolve(src, "error-handler.tsx"),
      "js-mvc": pkg,
      middlewares: resolve(src, "middlewares"),
      utils: resolve(src, "utils"),
      views: resolve(src, "views"),
    },
  },
  plugins: [
    sqlTransformPlugin(),
    sqlTypesPlugin({
      tableNameOverrides: {
        // Add overrides here, e.g.:
        people: "Person",
      },
    }),
    cssBuildPlugin(),
    clientBuildPlugin(),
    cloudflare({ inspectorPort: 9229 }),
  ],
  esbuild: {
    // esnext preserves decorator syntax at runtime which workerd does not
    // support yet; es2022 forces esbuild to transpile the Stage 3
    // decorators into executable helpers (including Symbol.metadata
    // wiring).
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "hono/jsx",
  },
  build: {
    cssMinify: true,
  },
  css: {
    postcss: {},
  },
});
