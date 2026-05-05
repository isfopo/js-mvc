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

    // Priority order: variables -> base -> layout -> everything else
    const priority = ["variables.css", "base.css", "layout.css"];
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
        return readFileSync(f, "utf-8");
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
