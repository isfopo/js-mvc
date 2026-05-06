import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { execSync } from "child_process";
import { resolve, basename, dirname } from "path";
import { readFileSync } from "fs";

const CSS_MODULE_PREFIX = "\0css-module:";

// Extract all class names from CSS content
function extractClassNames(css: string): Set<string> {
  const classNames = new Set<string>();
  const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = classRegex.exec(css)) !== null) {
    classNames.add(match[1]);
  }
  return classNames;
}

// Custom plugin to handle CSS Modules imports
function cssModulesPlugin(): Plugin {
  return {
    name: "css-modules",
    enforce: "pre",

    resolveId(id, importer) {
      if (id.endsWith(".module.css") && importer) {
        const resolved = resolve(dirname(importer), id);
        const componentName = basename(dirname(resolved));
        return CSS_MODULE_PREFIX + componentName;
      }
      return null;
    },

    load(id) {
      if (!id.startsWith(CSS_MODULE_PREFIX)) return null;

      const componentName = id.slice(CSS_MODULE_PREFIX.length);
      const filePath = resolve(
        process.cwd(),
        "src",
        "views",
        "components",
        componentName,
        "index.module.css",
      );
      const css = readFileSync(filePath, "utf-8");
      const classNames = extractClassNames(css);

      // Build the exported styles object
      const exports: string[] = [];
      classNames.forEach((name) => {
        exports.push(`  "${name}": "${componentName}_${name}"`);
      });

      return `export default {\n${exports.join(",\n")}\n};`;
    },
  };
}

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
      const componentsDir = resolve(
        process.cwd(),
        "src",
        "views",
        "components",
      );

      server.watcher.add(stylesDir);
      server.watcher.add(componentsDir);

      server.watcher.on("change", (file: string) => {
        if (
          (file.endsWith(".css") || file.endsWith(".module.css")) &&
          !file.includes("/public/")
        ) {
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
