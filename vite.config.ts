import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import {
  clientBuildPlugin,
  cssBuildPlugin,
  handlerRegistryPlugin,
  schemaPlugin,
  seedPlugin,
  sqlPlugin,
} from "./package/plugins/index.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const src = resolve(__dirname, "src");
const pkg = resolve(__dirname, "package", "src");

export default defineConfig({
  resolve: {
    alias: {
      // Top-level src/ directories — enables bare imports like "db/init"
      api: resolve(src, "api"),
      domains: resolve(src, "domains"),
      "error-handler": resolve(src, "error-handler.tsx"),
      // Client hooks moved into a hooks/ subdirectory; keep the public
      // import surface stable by aliasing each JSX hook to its new home.
      // Listed BEFORE the bare "js-mvc" alias so the longer, more specific
      // keys win over the prefix match.
      "js-mvc/client/useHandler": resolve(pkg, "client/hooks/useHandler.tsx"),
      "js-mvc/client/useEvent": resolve(pkg, "client/hooks/useEvent.tsx"),
      "js-mvc/client/useHide": resolve(pkg, "client/hooks/useHide.tsx"),
      "js-mvc/client/useDisable": resolve(pkg, "client/hooks/useDisable.tsx"),
      "js-mvc": pkg,
      middleware: resolve(src, "middleware"),
      utils: resolve(pkg, "utils"),
      views: resolve(src, "views"),
    },
  },
  plugins: [
    schemaPlugin(),
    seedPlugin(),
    sqlPlugin(),
    cssBuildPlugin({
      sourceDirs: ["src/views/tokens", "src/views/elements", "src/views/components", "src/views/routes"],
    }),
    clientBuildPlugin(),
    handlerRegistryPlugin({
      // Handlers are auto-discovered by this glob; no per-handler paths
      // need to be maintained in source.
      include: "src/views/handlers/**/*Handler.ts",
    }),
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
