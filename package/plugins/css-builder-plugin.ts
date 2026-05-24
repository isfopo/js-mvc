import type { Plugin, ViteDevServer } from "vite";
import { execSync } from "child_process";
import { resolve } from "path";

export interface CssBuilderPluginOptions {
  /** Directories to watch for CSS/module.css/SVG changes */
  watchDirs?: string[];
  /** Command to run to rebuild CSS (default: "npm run build:css") */
  buildCommand?: string;
  /** File to trigger HMR after CSS rebuild (default: null) */
  hmrTriggerFile?: string;
  /** File extensions to watch (default: [".css", ".module.css", ".svg"]) */
  watchExtensions?: string[];
  /** Paths to exclude from watching */
  excludePaths?: string[];
}

/**
 * Vite plugin that rebuilds CSS on file changes.
 *
 * Runs a build command (e.g. `npm run build:css`) when CSS files change,
 * then triggers HMR by emitting a change event on a specified file.
 */
export function cssBuilderPlugin(options: CssBuilderPluginOptions = {}): Plugin {
  const {
    watchDirs = [],
    buildCommand = "npm run build:css",
    hmrTriggerFile,
    watchExtensions = [".css", ".module.css", ".svg"],
    excludePaths = ["/public/", "/.generated/"],
  } = options;

  let isBuilding = false;

  return {
    name: "css-builder",

    buildStart() {
      console.log("🔨 Building CSS...");
      try {
        execSync(buildCommand, { stdio: "inherit" });
      } catch {
        console.error("CSS build failed");
      }
    },

    configureServer(server: ViteDevServer) {
      watchDirs.forEach((dir) => server.watcher.add(dir));

      server.watcher.on("change", (file: string) => {
        const isWatchedExt = watchExtensions.some((ext) => file.endsWith(ext));
        const isExcluded = excludePaths.some((path) => file.includes(path));

        if (isWatchedExt && !isExcluded) {
          console.log(`\n📝 ${file.split("/").pop()} changed, rebuilding CSS...`);

          if (!isBuilding) {
            isBuilding = true;
            try {
              execSync(buildCommand, { stdio: "inherit" });
              if (hmrTriggerFile) {
                server.watcher.emit("change", hmrTriggerFile);
              }
              console.log("✓ CSS rebuilt\n");
            } catch {
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
