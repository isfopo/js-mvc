# Extract `infrastructure/` → `package/` (Option A)

## Goal

Separate the generic framework code from the project-specific application code by moving `src/infrastructure/` into a new `package/` directory at the project root. This creates a clean boundary that prepares the codebase for eventual npm publishing while keeping everything in one repo during the exploratory phase.

---

## What's Generic vs Project-Specific

| Module | Verdict | Notes |
|---|---|---|
| `ControllerBase.tsx` | **Generic** | Must make `Layout` injectable |
| `RepositoryBase.ts` | **Generic** | References `D1Database` directly — keep for now, abstract later |
| `ServiceBase.ts` | **Generic** | Pure error helpers |
| `errors/index.tsx` | **Split** | Error classes → package; `handleError` → project |
| `validation/*` | **Generic** | Decorators, guard executor, descriptors, IValidatable, unflatten |
| `client/*` | **Split** | BaseHandler, dispatcher, types → package; `main.ts` handler imports → project |
| `utils/Action.tsx` | **Generic** | But `HandlerActions` interface is project-specific — must be made generic |
| `utils/State.*` | **Generic** | All 6 files |
| `middlewares/unflatten-form-body.ts` | **Generic** | Both the middleware and the utility |
| `.vite/plugins.ts` (`cssBuilderPlugin`) | **Project** | Watches project-specific paths (`src/styles`, `src/layouts`) |
| `.vite/plugins.ts` (`sqlTypesPlugin`) | **Split** | SQL transform (generic) + type generation (project paths) |
| `.vite/sql-types/*` | **Generic** | All 12 files — pure SQL parsing/type generation |

---

## Phase 1: Create the Package Skeleton and Move Files

### 1.1. Directory Structure

```
package/
├── src/
│   ├── controller/
│   │   ├── ControllerBase.tsx
│   │   └── ControllerBase.test.tsx
│   ├── repository/
│   │   ├── RepositoryBase.ts
│   │   └── RepositoryBase.test.ts
│   ├── service/
│   │   └── ServiceBase.ts
│   ├── errors/
│   │   └── index.tsx          # error classes only (no handleError)
│   ├── validation/
│   │   ├── decorators.ts
│   │   ├── guard-executor.ts
│   │   ├── guard-executor.test.ts
│   │   ├── GuardDescriptor.ts
│   │   ├── IValidatable.ts
│   │   ├── unflatten-form-body.ts
│   │   └── unflatten-form-body.test.ts
│   ├── client/
│   │   ├── BaseHandler.ts
│   │   ├── dispatcher.ts
│   │   └── types.d.ts
│   ├── middleware/
│   │   └── unflatten-form-body.ts
│   └── utils/
│       ├── Action.tsx
│       ├── State.tsx
│       ├── State.types.ts
│       ├── State.scope.ts
│       ├── State.css.ts
│       └── State.test.tsx
├── plugins/
│   ├── sql-transform-plugin.ts   # generic .sql YAML strip transform
│   └── sql-types/                # all 12 files from .vite/sql-types/
│       ├── parse-migrations.ts
│       ├── parse-migrations.test.ts
│       ├── parse-front-matter.ts
│       ├── parse-front-matter.test.ts
│       ├── generate-db-types.ts
│       ├── generate-db-types.test.ts
│       ├── generate-query-barrel.ts
│       ├── generate-query-barrel.test.ts
│       ├── generate-local-db.ts
│       ├── validate-sql.ts
│       ├── validate-sql.test.ts
│       └── utils.ts
├── tsconfig.json
└── package.json
```

### 1.2. Internal Import Updates

All internal imports within the package switch from `"infrastructure/..."` to relative paths:

```diff
-import { NotFoundError, ValidationError } from "infrastructure/errors/index";
+import { NotFoundError, ValidationError } from "../errors";

-import { getParsedBody } from "infrastructure/middlewares/unflatten-form-body";
+import { getParsedBody } from "../middleware/unflatten-form-body";

-import { unflattenFormBody } from "infrastructure/validation/unflatten-form-body";
+import { unflattenFormBody } from "../validation/unflatten-form-body";

-import { BaseHandler } from "infrastructure/client/BaseHandler";
+import { BaseHandler } from "./BaseHandler";
```

---

## Phase 2: Decouple Project-Specific Dependencies

### 2.1. ControllerBase — Inject Layout

Remove the hardcoded `import { Layout } from "views/routes/Shared/Layout"` and make it injectable:

```ts
import type { FC } from "hono/jsx";

export type LayoutComponent = (...args: any[]) => any;

  children: any;
}>;

export interface ControllerRenderConfig<T extends Env> {
  layout: LayoutComponent;
  handleError?: (c: Context<T>, error: unknown) => Response | Promise<Response>;
}

export abstract class ControllerBase<T extends Env> {
  _app: Hono<T>;
  abstract base: string;
  renderConfig?: ControllerRenderConfig<T>;

  constructor() {
    this._app = new Hono();
  }

  configureRendering(config: ControllerRenderConfig<T>): void {
    this.renderConfig = config;
  }

  register<E extends Env>(app: Hono<E>): void {
    // ... metadata reading ...

    this._app.use("*", async (c, next) => {
      c.setRenderer((content: any) => {
        const user = (c as any).get("user");
        const doctype = "<!DOCTYPE html>";
        const Layout = this.renderConfig?.layout;
        if (!Layout) {
          return c.html(doctype + renderToString(content));
        }
        const body = renderToString(
          <Layout user={user} currentPath={c.req.path}>
            {content}
          </Layout>,
        );
        return c.html(doctype + body);
      });
      await next();
    });

    for (const route of routes) {
      // ... guard filtering ...
      this._app[route.method](route.path, async (c: Context) => {
        try {
          for (const guard of handlerGuards) {
            await executeGuard(guard, c);
          }
          return (this as any)[route.handlerName](c);
        } catch (error: unknown) {
          const errorHandler = this.renderConfig?.handleError;
          if (errorHandler) {
            return errorHandler(c, error);
          }
          throw error;
        }
      });
    }

    app.route(this.base, this._app);
  }
}
```

### 2.2. errors/index.tsx — Remove `handleError`

Keep all error classes (`AppError`, `NotFoundError`, `ValidationError`, etc.) but remove the `handleError` function that renders `<ResultsView>`:

```diff
 import { StatusCode } from "hono/utils/http-status";
-import { ResultsView } from "views/routes/Shared/Results";
-import { Context } from "hono";

 export class AppError extends Error { ... }
 export class NotFoundError extends AppError { ... }
 // ... all error classes stay

-export function handleError(c: Context, error: unknown): Response { ... }
```

### 2.3. client/main.ts — Remove Handler Registrations

Remove the hardcoded project handler imports. Export `onReady` and `start` for the project to use:

```diff
-import "../../views/handlers/DismissHandler";
-import "../../views/handlers/ConfirmHandler";
-import "../../views/handlers/VoteHandler";
-import "../../views/handlers/StatusTransitionHandler";
-import "../../views/handlers/AddOptionHandler";
 import { start } from "./dispatcher";

 export function onReady(cb: () => void): void {
   if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", cb);
   } else {
     cb();
   }
 }

 start();
```

### 2.4. Action.tsx — Make `HandlerActions` Generic

Replace the hardcoded `HandlerActions` interface with a generic type parameter:

```diff
 import { JSX } from "hono/jsx";

-export interface HandlerActions {
-  dismiss: "hide";
-  confirm: "ask";
-  vote: "submit";
-  status: "transition";
-  addoption: "add";
-}

 export type KnownDOMEvent =
   | "click"
   | "submit"
   // ... (stays the same)

-export function Action<E extends keyof HandlerActions>(name: E) {
+export function Action<
+  HA extends Record<string, string>,
+  E extends keyof HA
+>(name: E) {
   function Wrapper({ tag, children, ...rest }: WrapperProps) { ... }

-  function Trigger({ event, method, children, ...dataProps }: TriggerProps<E>) {
+  function Trigger({ event, method, children, ...dataProps }: TriggerProps<HA, E>) {
     // ... (same logic)
   }

   Wrapper.Trigger = Trigger;
   return Wrapper;
 }

+type TriggerProps<HA extends Record<string, string>, E extends keyof HA> = {
+  event: KnownDOMEvent | (string & {});
+  method: HA[E];
+  children?: any;
+} & Record<string, any>;
```

### 2.5. guard-executor.ts — Fix Imports

```diff
 import type { Context } from "hono";
-import { NotFoundError, ValidationError } from "infrastructure/errors/index";
+import { NotFoundError, ValidationError } from "../errors";
 import type { GuardDescriptor } from "./GuardDescriptor";
 import type { IValidatable } from "./IValidatable";
-import { getParsedBody } from "infrastructure/middlewares/unflatten-form-body";
+import { getParsedBody } from "../middleware/unflatten-form-body";
```

### 2.6. middleware/unflatten-form-body.ts — Fix Imports

```diff
 import type { Context, MiddlewareHandler } from "hono";
-import { unflattenFormBody } from "infrastructure/validation/unflatten-form-body";
+import { unflattenFormBody } from "../validation/unflatten-form-body";
```

---

## Phase 3: Extract the SQL Types Plugin

### 3.1. Split sqlTypesPlugin into Generic + Project Parts

The plugin has two concerns:

- **Generic**: `.sql` file transform (strip YAML front matter) → goes in package
- **Project-specific**: watching `migrations/` and `src/data/`, generating `db-types.d.ts` and `local.db` → stays in project

**Generic transform** (`package/plugins/sql-transform-plugin.ts`):

```ts
import type { Plugin } from "vite";
import matter from "gray-matter";

export function sqlTransformPlugin(): Plugin {
  return {
    name: "sql-transform",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".sql")) return;
      const match = code.match(/^export default (.+);$/s);
      if (!match) return;
      try {
        const content = JSON.parse(match[1]);
        const { content: sql } = matter(content);
        return { code: `export default ${JSON.stringify(sql.trim())};`, map: null };
      } catch {
        return;
      }
    },
  };
}
```

### 3.2. Project-Side Plugin Wrapper

Stays in `.vite/plugins.ts` but imports the generic tools from the package:

```ts
// .vite/plugins.ts — PROJECT
import { sqlTransformPlugin } from "js-mvc/plugins";
import {
  parseMigrations,
  generateDbTypes,
  generateQueryBarrel,
  generateLocalDb,
} from "js-mvc/plugins/sql-types";

export function sqlTypesPlugin(options = {}) {
  // Uses the imported generic tools but with project-specific paths
  // (migrations/, src/data/, etc.)
  // ... same logic as current sqlTypesPlugin but imports from package
}
```

### 3.3. Move All 12 sql-types Files

Move all files from `.vite/sql-types/` to `package/plugins/sql-types/`. Update their internal imports to relative paths. They're all pure utilities with no project coupling.

---

## Phase 4: Set Up Path Aliases and Config

### 4.1. `package/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ESNext", "DOM"],
    "noImplicitOverride": true,
    "baseUrl": "src"
  },
  "include": ["src/**/*", "plugins/**/*"]
}
```

### 4.2. Root `tsconfig.json` — Add Path Alias

```diff
 {
   "compilerOptions": {
     "baseUrl": "src",
+    "paths": {
+      "js-mvc/*": ["../package/src/*"],
+      "js-mvc/plugins": ["../package/plugins/index.ts"],
+      "js-mvc/plugins/sql-types": ["../package/plugins/sql-types/index.ts"]
+    }
   }
 }
```

### 4.3. `vite.config.ts` — Add Matching Resolve Alias

```diff
 import { resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import { cloudflare } from "@cloudflare/vite-plugin";
 import { defineConfig } from "vite";
 import { cssBuilderPlugin, sqlTypesPlugin } from "./.vite/plugins";
+import { sqlTransformPlugin } from "js-mvc/plugins";

 const __dirname = fileURLToPath(new URL(".", import.meta.url));
 const src = resolve(__dirname, "src");
+const pkg = resolve(__dirname, "package", "src");

 export default defineConfig({
   resolve: {
     alias: {
       api: resolve(src, "api"),
       data: resolve(src, "data"),
-      infrastructure: resolve(src, "infrastructure"),
+      "js-mvc": pkg,
       middlewares: resolve(src, "middlewares"),
       utils: resolve(src, "utils"),
       views: resolve(src, "views"),
     },
   },
   plugins: [
+    sqlTransformPlugin(),
     sqlTypesPlugin(),
     cssBuilderPlugin(),
     cloudflare({ inspectorPort: 9229 }),
   ],
   esbuild: { target: "es2022" },
   build: { cssMinify: true },
   css: { postcss: {} },
 });
```

### 4.4. `vitest.config.ts` — Same Pattern

```diff
 import { resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
 import { defineConfig } from "vitest/config";
 import { sqlTypesPlugin } from "./.vite/plugins";
+import { sqlTransformPlugin } from "js-mvc/plugins";

 const __dirname = fileURLToPath(new URL(".", import.meta.url));
 const src = resolve(__dirname, "src");
+const pkg = resolve(__dirname, "package", "src");

 export default defineConfig({
   resolve: {
     alias: {
       api: resolve(src, "api"),
       data: resolve(src, "data"),
       db: resolve(src, "db"),
-      infrastructure: resolve(src, "infrastructure"),
+      "js-mvc": pkg,
       middlewares: resolve(src, "middlewares"),
       utils: resolve(src, "utils"),
       views: resolve(src, "views"),
     },
   },
   plugins: [
+    sqlTransformPlugin(),
     sqlTypesPlugin(),
     cloudflareTest({ ... }),
   ],
   test: {
-    include: ["src/**/*.test.ts", "src/**/*.test.tsx", ".vite/**/*.test.ts"],
+    include: [
+      "src/**/*.test.ts",
+      "src/**/*.test.tsx",
+      ".vite/**/*.test.ts",
+      "package/**/*.test.ts",
+      "package/**/*.test.tsx",
+    ],
   },
 });
```

---

## Phase 5: Update All Project Imports

### 5.1. Bulk Replace All 37 Import Sites

| Old Import | New Import |
|---|---|
| `"infrastructure/ControllerBase"` | `"js-mvc/controller/ControllerBase"` |
| `"infrastructure/RepositoryBase"` | `"js-mvc/repository/RepositoryBase"` |
| `"infrastructure/ServiceBase"` | `"js-mvc/service/ServiceBase"` |
| `"infrastructure/errors/index"` | `"js-mvc/errors"` |
| `"infrastructure/validation/decorators"` | `"js-mvc/validation/decorators"` |
| `"infrastructure/validation/IValidatable"` | `"js-mvc/validation/IValidatable"` |
| `"infrastructure/validation/guard-executor"` | `"js-mvc/validation/guard-executor"` |
| `"infrastructure/validation/GuardDescriptor"` | `"js-mvc/validation/GuardDescriptor"` |
| `"infrastructure/validation/unflatten-form-body"` | `"js-mvc/validation/unflatten-form-body"` |
| `"infrastructure/middlewares/unflatten-form-body"` | `"js-mvc/middleware/unflatten-form-body"` |
| `"infrastructure/client/BaseHandler"` | `"js-mvc/client/BaseHandler"` |
| `"infrastructure/client/dispatcher"` | `"js-mvc/client/dispatcher"` |
| `"infrastructure/utils/Action"` | `"js-mvc/utils/Action"` |
| `"infrastructure/utils/State"` | `"js-mvc/utils/State"` |

### 5.2. Create Project-Side `handleError`

```ts
// src/error-handler.ts
import { Context } from "hono";
import {
  AppError, NotFoundError, UnauthorizedError, ForbiddenError,
  ValidationError, ConflictError, RateLimitError, ServerError,
} from "js-mvc/errors";
import { ResultsView } from "views/routes/Shared/Results";

export function handleError(c: Context, error: unknown): Response | Promise<Response> {
  // ... current handleError body, unchanged
}
```

### 5.3. Create Project-Side Client Entry

```ts
// src/client-entry.ts
import "js-mvc/client/main";  // starts dispatcher

// Register project handlers
import "./views/handlers/DismissHandler";
import "./views/handlers/ConfirmHandler";
import "./views/handlers/VoteHandler";
import "./views/handlers/StatusTransitionHandler";
import "./views/handlers/AddOptionHandler";
```

### 5.4. Update Layout.tsx Script Src

```diff
-<script type="module" src="/@vite/client"></script>
+<script type="module" src="/src/client-entry.ts"></script>
```

### 5.5. Update Controllers to Pass Render Config

Per-controller approach:

```diff
 import { Get, Post, ControllerBase } from "js-mvc/controller/ControllerBase";
+import { Layout } from "views/routes/Shared/Layout";
+import { handleError } from "../../error-handler";

 class TenetsController extends ControllerBase<Env> {
   override base = "";

   constructor() {
     super();
+    this.configureRendering({
+      layout: Layout,
+      handleError,
+    });
     // ...
   }
 }
```

Or global approach (set once in `src/index.tsx`):

```ts
import { ControllerBase } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "./error-handler";

// Add a static method to ControllerBase for global defaults
ControllerBase.setDefaultRenderConfig({
  layout: Layout,
  handleError,
});
```

---

## Phase 6: Create package.json and Barrel Exports

### 6.1. `package/package.json`

```json
{
  "name": "js-mvc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./controller/ControllerBase": "./src/controller/ControllerBase.tsx",
    "./repository/RepositoryBase": "./src/repository/RepositoryBase.ts",
    "./service/ServiceBase": "./src/service/ServiceBase.ts",
    "./errors": "./src/errors/index.tsx",
    "./validation/decorators": "./src/validation/decorators.ts",
    "./validation/IValidatable": "./src/validation/IValidatable.ts",
    "./validation/guard-executor": "./src/validation/guard-executor.ts",
    "./validation/GuardDescriptor": "./src/validation/GuardDescriptor.ts",
    "./validation/unflatten-form-body": "./src/validation/unflatten-form-body.ts",
    "./middleware/unflatten-form-body": "./src/middleware/unflatten-form-body.ts",
    "./client/BaseHandler": "./src/client/BaseHandler.ts",
    "./client/dispatcher": "./src/client/dispatcher.ts",
    "./client/main": "./src/client/main.ts",
    "./client/types": "./src/client/types.d.ts",
    "./utils/Action": "./src/utils/Action.tsx",
    "./utils/State": "./src/utils/State.tsx",
    "./utils/State.types": "./src/utils/State.types.ts",
    "./utils/State.scope": "./src/utils/State.scope.ts",
    "./utils/State.css": "./src/utils/State.css.ts",
    "./plugins": "./plugins/index.ts",
    "./plugins/sql-types": "./plugins/sql-types/index.ts"
  }
}
```

### 6.2. `package/plugins/index.ts`

```ts
export { sqlTransformPlugin } from "./sql-transform-plugin";
```

### 6.3. `package/plugins/sql-types/index.ts`

```ts
export { parseMigrations } from "./parse-migrations";
export { generateDbTypes } from "./generate-db-types";
export { generateQueryBarrel } from "./generate-query-barrel";
export { generateLocalDb } from "./generate-local-db";
export { validateSql } from "./validate-sql";
export { parseFrontMatter } from "./parse-front-matter";
export type { TableDef } from "./parse-migrations";
```

---

## Phase 7: Verify Everything Works

| Step | Command | What It Proves |
|---|---|---|
| 1 | `npx tsc --noEmit` | All type resolution works across the boundary |
| 2 | `npm run dev` | Vite resolves `js-mvc/*` aliases, HMR works, CSS rebuilds |
| 3 | `npm run build` | Production build succeeds |
| 4 | `npx vitest run` | All tests pass (both package and project) |
| 5 | `npm run deploy` | Full deploy pipeline works |

---

## Dependency Graph

```
package/
├── controller/ControllerBase
│   ├── depends on: errors, validation/*, hono
│   └── injected by project: Layout, handleError
├── repository/RepositoryBase
│   └── depends on: D1Database (Cloudflare type)
├── service/ServiceBase
│   └── depends on: errors
├── errors
│   └── depends on: hono/utils/http-status
├── validation/*
│   ├── decorators → GuardDescriptor, IValidatable
│   ├── guard-executor → errors, validation, middleware
│   └── unflatten-form-body (standalone)
├── client/*
│   ├── dispatcher → types, main (onReady)
│   ├── BaseHandler → types
│   └── main → dispatcher (no handler imports)
├── middleware/unflatten-form-body
│   └── depends on: validation/unflatten-form-body, hono
├── utils/Action
│   └── generic (HA type parameter, no project coupling)
├── utils/State*
│   └── standalone
└── plugins/
    ├── sql-transform-plugin (generic .sql transform)
    └── sql-types/* (generic tools, called by project)

src/ (project)
├── error-handler.ts      → imports js-mvc/errors
├── client-entry.ts       → imports js-mvc/client/main + project handlers
├── index.tsx             → imports js-mvc/controller, js-mvc/middleware
├── controllers/*         → import js-mvc/controller, js-mvc/validation
├── repos/*               → import js-mvc/repository
├── services/*            → import js-mvc/service
├── views/*               → import js-mvc/utils/Action, js-mvc/utils/State
├── handlers/*            → import js-mvc/client/BaseHandler, js-mvc/client/dispatcher
└── .vite/plugins.ts      → imports js-mvc/plugins, js-mvc/plugins/sql-types
```

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Vite alias doesn't resolve `.tsx`/`.ts` extensions | Add `resolve.extensions: [".ts", ".tsx", ".js"]` in vite config |
| `D1Database` type not available in package tsconfig | Add `"types": ["@cloudflare/workers-types"]` to package tsconfig |
| `cssBuilderPlugin` hardcodes `src/styles`, `src/layouts` paths | Leave it in project — it's inherently project-specific |
| `Action.tsx` `HandlerActions` interface was project-specific | Now generic via `HA` type parameter; project defines its own |
| Tests in package reference `infrastructure/` imports | Update to relative paths during Phase 1 |
| `handleError` in `ControllerBase` references `ResultsView` | Removed in Phase 2; error handler is now injected |

---

## Platform Agnosticism — Strategy B

### Decision: Hono as HTTP Layer, Abstract the Database

The framework will accept **Hono** as its HTTP foundation (it's lightweight, standards-based, and runs on Node, Bun, Deno, Cloudflare, Vercel, Fastly, AWS Lambda) but will **abstract the database layer** so repositories work with any SQL database.

### Why Not Full HTTP Abstraction?

Abstracting the HTTP layer (Strategy A) sounds ideal but is a trap:
- Middleware patterns differ wildly between frameworks (Hono's `async (c, next)` vs Express's `(req, res, next)` vs Fastify's hooks)
- Response builders differ (`c.html` vs `res.send` vs `reply.html`)
- Context/storage patterns differ
- You end up building a least-common-denominator API that's worse than any single framework
- Hono is already portable — it runs everywhere that supports Web APIs

### What Changes

#### B.1. Define a `Database` Interface

```ts
// package/src/types.ts

/** Minimal database abstraction matching D1's API surface. */
export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<DbResult>;
}

export interface DbResult {
  meta: { last_row_id: number; changes: number };
}
```

#### B.2. Update RepositoryBase to Use the Interface

```diff
-export abstract class RepositoryBase<T extends { id: number }, QM = {}> {
+export abstract class RepositoryBase<
+  T extends { id: number },
+  QM = {},
+  DB extends Database = Database
+> {
   abstract readonly tableName: string;
   protected readonly queries?: { [P in keyof QM]: string };

-  protected readonly db: D1Database;
+  protected readonly db: DB;

-  constructor(db: D1Database) {
+  constructor(db: DB) {
     this.db = db;
   }
```

#### B.3. Ship a D1 Adapter (Zero Wrapper Needed)

D1's API already matches the `Database` interface exactly, so no wrapper is needed:

```ts
// package/src/adapters/d1.ts
// D1Database already satisfies the Database interface — no adapter code required.
// Just re-export for discoverability:
export type { D1Database } from "@cloudflare/workers-types";
```

For other databases, adapters would wrap their client:

```ts
// package/src/adapters/better-sqlite3.ts
import Database from "better-sqlite3";
import type { Database as FrameworkDatabase, Statement, DbResult } from "../types";

export function createBetterSQLite3Adapter(db: Database.Database): FrameworkDatabase {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            first: <T>() => stmt.get(...values) as T | null,
            all: <T>() => ({ results: stmt.all(...values) as T[] }),
            run: async () => {
              const info = stmt.run(...values);
              return { meta: { last_row_id: info.lastInsertRowId as number, changes: info.changes } };
            },
          };
        },
      };
    },
  };
}
```

#### B.4. Remove `D1Database` from Package tsconfig

The package should not reference `@cloudflare/workers-types`. Instead:

- `package/tsconfig.json` uses the `Database` interface from `types.ts`
- The project's `tsconfig.json` adds `"types": ["@cloudflare/workers-types"]`
- Project-side repo factories cast or pass the D1 instance as `Database`

```diff
 // package/tsconfig.json
 {
   "compilerOptions": {
-    "types": ["@cloudflare/workers-types"]
+    "types": []
   }
 }
```

#### B.5. Replace `StatusCode` from `hono/utils/http-status`

The `StatusCode` type is just a union of valid HTTP status codes. Replace it with a literal union to remove the Hono dependency from errors:

```diff
-import { StatusCode } from "hono/utils/http-status";
+export type StatusCode = 100 | 101 | 200 | 201 | 204 | 301 | 302 | 304 | 400 | 401 | 403 | 404 | 405 | 409 | 422 | 429 | 500 | 502 | 503;

 export class AppError extends Error {
-  readonly statusCode: StatusCode;
+  readonly statusCode: number;
```

#### B.6. Decouple JSX from `hono/jsx` in Utils

`Action.tsx` and `State.tsx` import `JSX` from `hono/jsx` for typing. Replace with a minimal type:

```diff
-import { JSX } from "hono/jsx";
+// Minimal JSX element type — works with any JSX implementation
+type JSXElement = { tag: string; props?: Record<string, any>; children?: any };
```

Or just use `any` for the child element check — JSX is a compile-time concern, not runtime:

```diff
-    if (children != null && typeof children === "object" && "tag" in children && !Array.isArray(children)) {
+    if (children != null && typeof children === "object" && "props" in children && !Array.isArray(children)) {
```

### Updated Coupling After Strategy B

| Module | Hono Coupling | Cloudflare Coupling | Status |
|---|---|---|---|
| `ControllerBase` | **Yes** (intentional) | None | Hono is the HTTP layer |
| `RepositoryBase` | None | None | Uses `Database` interface |
| `validation/*` | **Yes** (intentional) | None | Hono Context for guards |
| `middleware/*` | **Yes** (intentional) | None | Hono middleware pattern |
| `errors` | None (StatusCode replaced) | None | Fully agnostic |
| `utils/Action` | None (JSX type replaced) | None | Fully agnostic |
| `utils/State` | None (JSX type replaced) | None | Fully agnostic |
| `client/*` | None | None | Pure DOM, fully agnostic |
| `plugins/*` | None | None | Build-time Node.js only |

### Updated Dependency Graph

```
package/
├── controller/ControllerBase
│   ├── depends on: hono (intentional), errors, validation/*
│   └── injected by project: Layout, handleError
├── repository/RepositoryBase
│   └── depends on: Database interface (agnostic)
├── adapters/
│   ├── d1.ts (zero-cost — D1 already matches Database)
│   └── better-sqlite3.ts (example adapter)
├── types.ts
│   └── Database, Statement, DbResult interfaces
├── service/ServiceBase
│   └── depends on: errors
├── errors
│   └── depends on: nothing (StatusCode is a literal union)
├── validation/*
│   ├── depends on: hono (intentional), errors, middleware
│   └── unflatten-form-body (standalone)
├── client/*
│   └── pure DOM — no framework dependencies
├── middleware/unflatten-form-body
│   └── depends on: hono (intentional), validation
├── utils/Action
│   └── no framework dependencies (generic JSX type)
├── utils/State*
│   └── no framework dependencies
└── plugins/
    ├── sql-transform-plugin (generic .sql transform)
    └── sql-types/* (generic tools, called by project)
```

---

## Future: Publishing to npm

Once the package is self-contained, publishing is straightforward:

1. Add a build step (e.g., `tsup` or `esbuild`) to compile to `dist/`
2. Update `exports` in `package.json` to point to `dist/` files
3. Add a `files` field to limit what gets published
4. Run `npm publish`

The `private: true` in the current `package.json` prevents accidental publishing during exploration.
