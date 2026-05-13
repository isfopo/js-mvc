import type { Plugin, ViteDevServer } from "vite";
import { execSync } from "child_process";
import { resolve, dirname } from "path";

/**
 * Custom plugin to rebuild the global CSS bundle on file changes.
 */
export function cssBuilderPlugin(): Plugin {
  let isBuilding = false;

  return {
    name: "css-builder",

    buildStart() {
      console.log("🔨 Building CSS...");
      try {
        execSync("npm run build:css", { stdio: "inherit" });
      } catch (e) {
        console.error("CSS build failed");
      }
    },

    configureServer(server: ViteDevServer) {
      const watchDirs = [
        resolve(process.cwd(), "src", "styles"),
        resolve(process.cwd(), "src", "components"),
        resolve(process.cwd(), "src", "pages"),
        resolve(process.cwd(), "src", "assets", "icons"),
      ];

      watchDirs.forEach((dir) => server.watcher.add(dir));

      server.watcher.on("change", (file: string) => {
        if (
          (file.endsWith(".css") || file.endsWith(".module.css") || file.endsWith(".svg")) &&
          !file.includes("/public/") &&
          !file.includes("/.generated/")
        ) {
          console.log(`\n📝 ${file.split("/").pop()} changed, rebuilding CSS...`);

          if (!isBuilding) {
            isBuilding = true;
            try {
              execSync("npm run build:css", { stdio: "inherit" });
              const layoutFile = resolve(process.cwd(), "src", "layouts", "Layout.tsx");
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
