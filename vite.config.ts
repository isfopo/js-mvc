import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { cssBuilderPlugin } from "./.vite/plugins";

export default defineConfig({
  plugins: [
    cssBuilderPlugin(),
    cloudflare({ inspectorPort: 9229 }),
  ],
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
