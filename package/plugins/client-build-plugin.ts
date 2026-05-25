import type { Plugin } from "vite";
import { build, type BuildOptions } from "esbuild";
import { resolve, dirname } from "path";
import { mkdirSync } from "node:fs";

export interface ClientBuildPluginOptions {
  /**
   * Entry point for the client bundle (relative to project root or absolute).
   * @default "src/client-entry.ts"
   */
  entryPoint?: string;

  /**
   * Output file path for the bundled client JS (relative to project root or absolute).
   * @default "public/.generated/client/main.js"
   */
  outfile?: string;

  /**
   * Additional esbuild options (e.g., external packages, define, etc.).
   */
  esbuildOptions?: Partial<BuildOptions>;
}

/**
 * Vite plugin that bundles client-side TypeScript during `vite build`.
 *
 * Uses esbuild to compile the client entry point into a static JS bundle
 * served as a production asset. Skipped during dev mode (Vite handles
 * HMR natively for the entry point).
 */
export function clientBuildPlugin(options: ClientBuildPluginOptions = {}): Plugin {
  const {
    entryPoint = "src/client-entry.ts",
    outfile = "public/.generated/client/main.js",
    esbuildOptions = {},
  } = options;

  return {
    name: "client-build",

    async closeBundle() {
      // Only run during production builds, not dev
      if (process.env.NODE_ENV === "development") {
        return;
      }

      console.log("🔨 Building client JS...");

      const outDir = dirname(outfile);
      mkdirSync(outDir, { recursive: true });

      try {
        await build({
          entryPoints: [entryPoint],
          outfile,
          bundle: true,
          format: "esm",
          target: "es2020",
          sourcemap: true,
          minify: true,
          ...esbuildOptions,
        });

        console.log("✓ Client JS built\n");
      } catch (err) {
        console.error("✗ Client build failed:", (err as Error).message);
      }
    },
  };
}
