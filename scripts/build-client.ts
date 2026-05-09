/**
 * Builds client-side TypeScript to a static JS bundle.
 *
 * Uses esbuild to compile src/client/main.ts → public/client/main.js.
 * Output goes into the public/ directory so it's served as a static asset
 * by the Cloudflare Worker in both dev and production.
 */

import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function main() {
  console.log("🔨 Building client JS...");

  await build({
    entryPoints: [resolve(rootDir, "src", "infrastructure", "client", "main.ts")],
    outfile: resolve(rootDir, "public", "client", "main.js"),
    bundle: true,
    format: "esm",
    target: "es2020",
    sourcemap: true,
    minify: process.env.NODE_ENV === "production",
  });

  console.log("✓ Client JS built\n");
}

main().catch((err) => {
  console.error("Client build failed:", err);
  process.exit(1);
});
