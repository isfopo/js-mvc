import { PurgeCSS } from "purgecss";
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

// Get all CSS files from src/styles
function getCSSFiles(): string[] {
  const stylesDir = resolve(rootDir, "src", "styles");
  return getFiles(stylesDir, ".css")
    .filter((f) => !f.includes("/public/")) // Exclude generated files
    .sort((a, b) => {
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

// Get all page components (files in src/views/pages/)
function getPageFiles(): Array<{ name: string; path: string }> {
  const pagesDir = resolve(rootDir, "src", "views", "pages");
  const pages: Array<{ name: string; path: string }> = [];

  try {
    const entries = readdirSync(pagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx"))
      ) {
        const name = basename(entry.name, extname(entry.name))
          .replace(/Page$/, "") // Strip Page suffix
          .replace(/([A-Z])/g, "-$1") // Convert camelCase to kebab-case
          .toLowerCase()
          .replace(/^-/, ""); // Remove leading dash

        pages.push({
          name,
          path: resolve(pagesDir, entry.name),
        });
      }
    }
  } catch (e) {
    console.warn("No pages directory found");
  }

  return pages;
}

// Get all JSX/TSX files for PurgeCSS content
function getAllJSXFiles(): string[] {
  const srcDir = resolve(rootDir, "src");
  return getFiles(srcDir, ".tsx").concat(getFiles(srcDir, ".jsx"));
}

// Generate route-specific CSS
async function generateRouteCSS(
  routeName: string,
  contentFiles: string[],
  fullCSS: string,
  outputDir: string,
) {
  const purgeCSS = new PurgeCSS();
  const result = await purgeCSS.purge({
    content: contentFiles,
    css: [{ raw: fullCSS }],
    safelist: [
      /data-.*/,
      /sr-only/,
      /^:/, // Keep pseudo-elements
    ],
  });

  const outputPath = resolve(outputDir, `${routeName}.css`);
  writeFileSync(outputPath, result[0].css);

  const fullSize = fullCSS.length;
  const optimizedSize = result[0].css.length;
  const savings = (((fullSize - optimizedSize) / fullSize) * 100).toFixed(1);

  console.log(
    `✓ Generated ${routeName}.css (${optimizedSize} bytes, ${savings}% reduction)`,
  );
}

// Main build process
async function main() {
  console.log("Building CSS...\n");

  // Step 1: Combine all CSS
  const fullCSS = combineCSS();

  // Step 2: Write full bundle to public/styles/
  const publicDir = resolve(rootDir, "public", "styles");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(resolve(publicDir, "styles.css"), fullCSS);
  console.log(`\n✓ Full bundle: ${fullCSS.length} bytes\n`);

  // Step 3: Generate route-specific CSS
  const pages = getPageFiles();
  const allJSXFiles = getAllJSXFiles();
  const layoutFile = resolve(rootDir, "src", "views", "shared", "Layout.tsx");

  console.log(`Found ${pages.length} page(s):`);
  pages.forEach((p) => console.log(`  - ${p.name}`));
  console.log();

  for (const page of pages) {
    // Include page file, layout, and all shared components
    const contentFiles = [page.path, layoutFile, ...allJSXFiles];

    await generateRouteCSS(page.name, contentFiles, fullCSS, publicDir);
  }

  console.log("\n✓ CSS build complete!");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
