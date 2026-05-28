# AGENTS.md — js-mvc

## Project

Cloudflare Worker using **Hono** with server-side JSX (`hono/jsx`). MVC architecture.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Deploy | `npm run build && wrangler deploy` |
| Build (for preview) | `npm run build` |
| Preview build | `npm run preview` |
| Generate Cloudflare binding types | `npm run cf-typegen` |
| Build CSS only | `npm run build:css` |

No linter, formatter, or test framework yet.

### CSS Build Process

The CSS build is **automatic** with full HMR support:

1. **Development** (`npm run dev`):
   - CSS builds once at startup
   - Vite watches `src/views/styles/**/*.css`, `src/views/components/**/*.module.css`, and `src/views/routes/**/*.module.css`
   - On save: CSS rebuilds + Layout HMR updates instantly
   
2. **Production build** (`npm run build`): CSS builds, then Vite bundles

3. **Deploy** (`npm run deploy`): CSS builds → Vite builds → Wrangler deploys

**When to manually run `npm run build:css`:**
- To verify CSS output without starting the dev server
- In CI/CD pipelines if you need the CSS files before the main build

## Architecture

- **Entry point:** `src/index.tsx` — creates the `Hono` app, mounts controllers, and defines the root route directly.
- **Controllers** (`src/views/routes/*/controller.tsx`): Each controller extends `ControllerBase` from `js-mvc/controller/ControllerBase`, sets an override `base` string (the route prefix), declares routes via decorators, and calls `configureRendering({ layout, handleError })` in the constructor to wire up the shared layout and error handler.
- **API Controllers** (`src/views/routes/*/controller.api.tsx`): Same pattern but return JSON. Share business logic via services.
- **Views** (`src/views/routes/*/views/`): Top-level page components using `FC` from `hono/jsx` with typed ViewModel.
- **Components** (`src/views/components/`): Reusable UI pieces. Use `Action()` from `js-mvc/utils/Action` for client-side handler wiring.
- **Services** (`src/data/*/service.ts`): Business logic layer shared between HTML and API controllers. Extend `ServiceBase` from `js-mvc/service/ServiceBase`.
- **Repositories** (`src/data/*/repo.ts`): Data access layer. Extend `RepositoryBase<T, QueryMap>` from `js-mvc/repository/RepositoryBase`. D1Database is injected via constructor; repos are created per-request using factory functions (e.g., `tenetsRepo(db)`). Inherit generic CRUD (`findById`, `findAll`, `create`, `update`, `delete`, `count`) and dynamic finders (`findOneBy`, `findAllBy`, `existsBy`, `deleteBy`). Complex queries use `.sql` files with YAML front matter and typed `queryOne`/`queryAll`/`execute` methods. See **Repository Security** below for validation details.
- **Models** (`src/data/*/model.ts`): Row types matching D1 table columns.
- **Requests** (`src/views/routes/*/requests/`): IValidatable form objects with `validate()` method.
- **Framework** (`package/src/`): Reusable framework code imported via `js-mvc/*` path aliases. Contains `ControllerBase`, `RepositoryBase`, `ServiceBase`, `BaseHandler`, validation decorators, error classes, and utilities.
- **Client entry** (`src/client-entry.ts`): Imports the framework dispatcher (`js-mvc/client/main`) and registers project-specific handlers.
- **Error handler** (`src/error-handler.tsx`): Project-specific error handling that maps `AppError` subclasses to HTML responses. Imported by controllers via `configureRendering()`.

## Routing Convention

Routes are declared with decorators from `ControllerBase`:

```ts
import { Get, Post, Delete, ControllerBase } from "./ControllerBase";

class MyController extends ControllerBase {
  override base = "api";

  @Get("/")          // GET /api
  @Get("/users")     // GET /api/users
  @Post("/users")    // POST /api/users
  @Get("/users/:id") // GET /api/users/:id
  @Delete("/users")  // DELETE /api/users
}
```

- Any valid Hono path works (`:id`, `*` wildcards, nested segments, etc.).
- The full route is `base` + decorator `path`.

## Guard Decorators

Use validation/guard decorators to handle cross-cutting concerns before route handlers:

```ts
import { Exists, Validate } from "js-mvc/validation/decorators";
import { ProposeTenetRequest } from "../../data/requests/ProposeTenetRequest";

class TenetsController extends ControllerBase {
  @Get("/:slug")
  @Exists("tenet", (c) => tenetsRepo(c.env.DB).findOneBy({ slug: c.req.param("slug")! }))
  async show(c: Context) {
    const tenet = c.get("tenet"); // loaded by @Exists, throws 404 if missing
    // ...
  }

  @Post("/")
  @Validate(ProposeTenetRequest)
  async create(c: Context) {
    const input = c.get("validated") as ProposeTenetRequest; // already validated
    // ...
  }
}
```

## Repository Security

`RepositoryBase` includes built-in validation to prevent SQL injection:

### Column Name Validation

All methods that build SQL from object keys (`create`, `update`, `findOneBy`, `findAllBy`, `existsBy`, `deleteBy`) validate column names using `validateColumnName()`:

```ts
// Safe — valid column names
await repo.findOneBy({ slug: "my-tenet" });
await repo.create({ title: "New Tenet", status: "draft" });

// Unsafe — throws Error: Unsafe column name: "123abc"
await repo.findOneBy({ "123abc": "value" } as any);
```

Column names must match `/^[a-zA-Z_]\w*$/` (start with letter/underscore, then alphanumeric/underscore).

### ORDER BY Validation

`findAll({ orderBy })` validates the ORDER BY clause using `validateOrderBy()`:

```ts
// Safe — valid ORDER BY
await repo.findAll({ orderBy: "created_at DESC" });
await repo.findAll({ orderBy: "status, title ASC" });

// Unsafe — throws Error: Unsafe ORDER BY clause
await repo.findAll({ orderBy: "id; DROP TABLE users" });
```

Only allows column names, commas, spaces, and ASC/DESC keywords. SQL keywords like UNION, SELECT, DROP are rejected.

### Null Handling in Dynamic Finders

Dynamic finders handle null values correctly using `IS NULL` (since `col = NULL` is always false in SQL):

```ts
// Finds users where avatar_url IS NULL
await usersRepo(db).findOneBy({ avatar_url: null });

// Generates: WHERE avatar_url IS NULL AND login = ?
await usersRepo(db).findOneBy({ avatar_url: null, login: "alice" });
```

### Empty Criteria Protection

Dynamic finders throw on empty criteria to prevent accidental full-table operations:

```ts
// Throws: Empty criteria is not allowed. Use findAll() for unfiltered queries.
await repo.findOneBy({});
await repo.deleteBy({});
```

## Client-Side Handlers — Use `Action()` Always

**Never write `data-controller` or `data-action` attributes manually.** Always use the `Action()` component factory from `js-mvc/utils/Action`.

```tsx
import { Action } from "js-mvc/utils/Action";

const MyHandler = Action("myhandler");

// Wrapper + Trigger — handler scoped to a container
<MyHandler start="2">
  <div>
    {content}
  </div>
  <MyHandler.Trigger event="click" method="add">
    <button>Add</button>
  </MyHandler.Trigger>
</MyHandler>

// Trigger-only — handler lives on the element itself
<MyHandler.Trigger event="click" method="submit" choice="approve">
  <button class="primary">Approve</button>
</MyHandler.Trigger>
```

Extra props passed to `Wrapper` or `Trigger` are automatically converted to `data-{handler}-{key}` attributes. This keeps handler names and method names in sync between server views and client handlers.

Every new client handler must:
1. Be added to `HandlerActions` in `src/utils/Action.tsx`
2. Be imported in `src/client-entry.ts`

## Layout / Rendering

Controllers wrap every route response in a layout automatically via `configureRendering()`:

```ts
import { ControllerBase, Get } from "js-mvc/controller/ControllerBase";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";

class MyController extends ControllerBase {
  override base = "my";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
  }
}
```

- Use `c.render(<View />)` to render JSX wrapped in Layout
- Controllers that need auth call `this._app.use("*", requireAuth())` in their constructor
- The Layout receives all values set via `c.set()` (e.g., `user`) plus `currentPath`

## Conventions

- `"type": "module"` in package.json — always use ESM imports.
- `noImplicitOverride: true` in tsconfig — `override` keyword required on derived class members.
- `wrangler.jsonc` is gitignored (contains real D1/KV IDs). Use `wrangler.jsonc.example` as template.
- `worker-configuration.d.ts` is auto-generated by `npm run cf-typegen`; do not hand-edit.
- Decorators follow the **Stage 3 TC39 proposal** (not `experimentalDecorators`).
  `reflect-metadata` is **not** used — metadata is stored via `context.metadata`
  and read back via `Constructor[Symbol.metadata]`. A `Symbol.metadata` polyfill
  is included in `ControllerBase.tsx` for environments that lack it.
- Views use **semantic HTML** and rely on **Pico CSS defaults** for styling. Inline styles are prohibited.
  Custom layouts use CSS Modules in the same directory (e.g., `index.module.css`, `new.module.css`).
- Framework code lives in `package/` and is imported via `js-mvc/*` path aliases.
  Application code lives in `src/` and imports framework code, never the reverse.
- Build scripts have been replaced by Vite plugins (`cssBuildPlugin`, `clientBuildPlugin`, `sqlTypesPlugin`, `sqlTransformPlugin`).
