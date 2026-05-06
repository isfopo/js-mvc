import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { execSync } from "child_process";
import { resolve } from "path";

// Custom plugin to rebuild CSS on file changes
function cssBuilderPlugin(): Plugin {
  let isBuilding = false;

  return {
    name: "css-builder",

    // Run once at startup
    buildStart() {
      console.log("🔨 Building CSS...");
      try {
        execSync("npm run build:css", { stdio: "inherit" });
      } catch (e) {
        console.error("CSS build failed");
      }
    },

    // Watch CSS files for changes
    configureServer(server: ViteDevServer) {
      const stylesDir = resolve(process.cwd(), "src", "styles");

      server.watcher.add(stylesDir);

      server.watcher.on("change", (file: string) => {
        if (file.endsWith(".css") && !file.includes("/public/")) {
          console.log(
            `\n📝 ${file.split("/").pop()} changed, rebuilding CSS...`,
          );

          if (!isBuilding) {
            isBuilding = true;
            try {
              execSync("npm run build:css", { stdio: "inherit" });

              // Trigger HMR for Layout file to reload CSS
              const layoutFile = resolve(
                process.cwd(),
                "src",
                "views",
                "shared",
                "Layout.tsx",
              );
              server.watcher.emit("change", layoutFile);

              console.log("✓ CSS rebuilt\n");
            } catch (e) {
              console.error("✗ CSS build failed\n");
            } finally {
              isBuilding = false;
            }
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [cssBuilderPlugin(), cloudflare({ inspectorPort: 9229 })],
  build: {
    cssMinify: true,
  },
  css: {
    postcss: {},
  },
  assetsInclude: ["**/*.css"],
});
