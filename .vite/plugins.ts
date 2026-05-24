import { resolve } from "path";
import { cssBuilderPlugin, sqlTypesPlugin } from "../package/plugins/index.ts";

/**
 * CSS builder plugin — project-specific configuration.
 *
 * Watches project CSS/module.css/SVG files and runs `npm run build:css`
 * on changes, then triggers HMR via the Layout file.
 */
export function createCssBuilderPlugin() {
  return cssBuilderPlugin({
    watchDirs: [
      resolve(process.cwd(), "src", "styles"),
      resolve(process.cwd(), "src", "components"),
      resolve(process.cwd(), "src", "pages"),
      resolve(process.cwd(), "src", "assets", "icons"),
    ],
    hmrTriggerFile: resolve(process.cwd(), "src", "layouts", "Layout.tsx"),
  });
}

/**
 * SQL types plugin — project-specific configuration.
 *
 * Parses migrations, generates db-types.d.ts, local.db, and typed query barrels.
 */
export function createSqlTypesPlugin() {
  return sqlTypesPlugin({
    tableNameOverrides: {
      // Add overrides here, e.g.:
      // "people": "Person",
    },
  });
}
