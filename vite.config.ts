import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { cssBuilderPlugin } from "./.vite/plugins";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const src = resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: {
      // Top-level src/ directories — enables bare imports like "db/init"
      api: resolve(src, "api"),
      db: resolve(src, "db"),
      infrastructure: resolve(src, "infrastructure"),
      middlewares: resolve(src, "middlewares"),
      utils: resolve(src, "utils"),
      views: resolve(src, "views"),
    },
  },
  plugins: [cssBuilderPlugin(), cloudflare({ inspectorPort: 9229 })],
  esbuild: {
    // esnext preserves decorator syntax at runtime which workerd does not
    // support yet; es2022 forces esbuild to transpile the Stage 3
    // decorators into executable helpers (including Symbol.metadata
    // wiring).
    target: "es2022",
  },
  build: {
    cssMinify: true,
  },
  css: {
    postcss: {},
  },
});
