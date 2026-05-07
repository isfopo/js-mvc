import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { cssModulesPlugin, cssBuilderPlugin } from "./.vite/plugins";

export default defineConfig({
  plugins: [
    cssModulesPlugin(),
    cssBuilderPlugin(),
    cloudflare({ inspectorPort: 9229 }),
  ],
  build: {
    cssMinify: true,
  },
  css: {
    postcss: {},
  },
  assetsInclude: ["**/*.css"],
});
