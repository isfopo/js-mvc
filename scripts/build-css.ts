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

// Inline SVG references in CSS: url("inline-svg:icons/name.svg")
function inlineSVGs(css: string, cssFilePath: string): string {
  const svgRefRegex = /url\(\s*["']?inline-svg:([^"')]+)["']?\s*\)/gi;

  return css.replace(svgRefRegex, (match, svgPath: string) => {
    try {
      let resolvedPath: string;
      if (svgPath.startsWith("./") || svgPath.startsWith("../")) {
        resolvedPath = resolve(dirname(cssFilePath), svgPath);
      } else {
        resolvedPath = resolve(rootDir, "src", "assets", svgPath);
      }

      let svg = readFileSync(resolvedPath, "utf-8");

      // Simple minification: remove XML comments and collapse whitespace
      svg = svg
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/>\s+</g, "><")
        .trim();

      const encoded = encodeURIComponent(svg)
        .replace(/%20/g, " ")
        .replace(/%3D/g, "=")
        .replace(/%3A/g, ":")
        .replace(/%2F/g, "/");

      return `url("data:image/svg+xml,${encoded}")`;
    } catch (e) {
      console.warn(
        `Warning: Could not inline SVG ${svgPath} from ${cssFilePath}`,
      );
      return match;
    }
  });
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

// Get CSS files from the views directory tree (styles, components, and pages)
function getCSSFiles(): string[] {
  const stylesDir = resolve(rootDir, "src", "views", "styles");
  const componentsDir = resolve(rootDir, "src", "views", "components");
  const pagesDir = resolve(rootDir, "src", "views", "pages");

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

  // Add page CSS modules
  try {
    const pageCSS = getFiles(pagesDir, ".css");
    cssFiles = cssFiles.concat(pageCSS);
  } catch {
    // No pages directory yet
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

        // Inline SVG references before scoping
        content = inlineSVGs(content, f);

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

  // Step 2: Write full bundle to .generated/styles/
  const outDir = resolve(rootDir, "public", ".generated", "styles");
  mkdirSync(outDir, { recursive: true });
  const minifiedFull = new CleanCSS().minify(fullCSS).styles;
  writeFileSync(resolve(outDir, "index.css"), minifiedFull);
  console.log(`\n✓ Full bundle: ${minifiedFull.length} bytes (minified)\n`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
