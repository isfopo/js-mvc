/**
 * Project-side client entry point.
 *
 * Handlers are auto-discovered and registered by `handlerRegistryPlugin`
 * during the Vite build (see the generated `src/.generated/handlers.ts`).
 * This module just triggers that registration and re-exports hydration
 * functions for inline client behavior scripts.
 */

import "./.generated/handlers";

export { hydrate, hydrateEvent } from "js-mvc/client/main";
