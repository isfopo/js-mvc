import { PurgeCSS } from "purgecss";
import CleanCSS from "clean-css";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { resolve, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// Recursively get all files with given extension
function getFiles(dir: string, ext: string, files: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      getFiles(fullPath, ext, files);
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

// Apply CSS Modules scoping to a file's content
function scopeCSSModules(css: string, filePath: string): string {
  const componentName = basename(dirname(filePath));

  // Split by url(...) to avoid replacing inside URLs, then scope class selectors
  const parts = css.split(/(url\([\s\S]*?\))/g);

  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // url(...) parts, keep as-is

      // Replace class selectors: .className → .ComponentName_className
      return part.replace(
        /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g,
        `.${componentName}_$1`,
      );
    })
    .join("");
}

// Get all CSS files from src/styles and src/views/components
function getCSSFiles(): string[] {
  const stylesDir = resolve(rootDir, "src", "styles");
  const componentsDir = resolve(rootDir, "src", "views", "components");

  let cssFiles = getFiles(stylesDir, ".css").filter(
    (f) => !f.includes("/public/"),
  ); // Exclude generated files

  // Add component CSS modules
  try {
    const componentCSS = getFiles(componentsDir, ".css");
    cssFiles = cssFiles.concat(componentCSS);
  } catch {
    // No components directory yet
  }

  return cssFiles.sort((a, b) => {
    const aName = basename(a);
    const bName = basename(b);

    // Priority order: variables -> themes -> reset -> layout -> everything else
    const priority = ["variables.css", "themes.css", "reset.css", "layout.css"];
    const aPriority = priority.indexOf(aName);
    const bPriority = priority.indexOf(bName);

    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    // Sort remaining files alphabetically by full path
    return a.localeCompare(b);
  });
}

// Combine all source CSS files
function combineCSS(): string {
  const cssFiles = getCSSFiles();

  console.log(`Found ${cssFiles.length} CSS source files:`);
  cssFiles.forEach((f) => console.log(`  - ${basename(f)}`));

  return cssFiles
    .map((f) => {
      try {
        let content = readFileSync(f, "utf-8");

        // Scope CSS Modules files to match Vite's generateScopedName
        if (f.endsWith(".module.css")) {
          content = scopeCSSModules(content, f);
        }

        return content;
      } catch (e) {
        console.warn(`Warning: Could not read ${f}`);
        return "";
      }
    })
    .join("\n\n");
}

// Main build process
async function main() {
  console.log("Building CSS...\n");

  // Step 1: Combine all CSS
  const fullCSS = combineCSS();

  // Step 2: Write full bundle to public/styles/
  const publicDir = resolve(rootDir, "public", "styles");
  mkdirSync(publicDir, { recursive: true });
  const minifiedFull = new CleanCSS().minify(fullCSS).styles;
  writeFileSync(resolve(publicDir, "index.css"), minifiedFull);
  console.log(`\n✓ Full bundle: ${minifiedFull.length} bytes (minified)\n`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
