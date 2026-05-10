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
   - Vite watches `src/styles/**/*.css`, `src/components/**/*.module.css`, and `src/pages/**/*.module.css`
   - On save: CSS rebuilds + Layout HMR updates instantly
   
2. **Production build** (`npm run build`): CSS builds, then Vite bundles

3. **Deploy** (`npm run deploy`): CSS builds → Vite builds → Wrangler deploys

**When to manually run `npm run build:css`:**
- To verify CSS output without starting the dev server
- In CI/CD pipelines if you need the CSS files before the main build

## Architecture

- **Entry point:** `src/index.tsx` — creates the `Hono` app, mounts controllers, and defines the root route directly.
- **Controllers** (`src/pages/*/controller.tsx`): Each controller extends `ControllerBase`, sets an override `base` string (the route prefix), and declares routes via decorators (see **Routing Convention** below). New controllers must be registered in `infrastructure/controllers/index.ts`.
- **API Controllers** (`src/api/*/controller.tsx`): Same pattern but return JSON. Share business logic via services.
- **Views** (`src/pages/*/views/`): Top-level page components using `FC` from `hono/jsx` with typed ViewModel.
- **Components** (`src/components/`): Reusable UI pieces. Use `Action()` for client-side handler wiring.
- **Services** (`src/services/`): Business logic layer shared between HTML and API controllers. Extend `ServiceBase`.
- **Repositories** (`src/data/repos/`): Data access layer. Extend `RepositoryBase<T>`. Use `db.prepare(sql).bind(params).all<T>()`.
- **Models** (`src/data/models/`): Row types matching D1 table columns.
- **Requests** (`src/data/requests/`): IValidatable form objects with `validate()` method.
- **Infrastructure** (`src/infrastructure/`): Framework base classes (ControllerBase, RepositoryBase, ServiceBase), validation decorators, auth middleware.

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
import { Exists, Validate } from "../../infrastructure/validation/decorators";
import { ProposeTenetRequest } from "../../data/requests/ProposeTenetRequest";

class TenetsController extends ControllerBase {
  @Get("/:slug")
  @Exists("tenet", (c) => tenetsRepo.findBySlug(c.env.DB, c.req.param("slug")!))
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

## Client-Side Handlers — Use `Action()` Always

**Never write `data-controller` or `data-action` attributes manually.** Always use the `Action()` component factory from `src/utils/Action.tsx`.

```tsx
import { Action } from "../../../utils/Action";

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
2. Be registered in `src/infrastructure/client/main.ts`

## Layout / Rendering

Controllers can wrap every route response in a layout automatically via `ControllerBase.register()`.

- Use `c.render(<View />)` to render JSX wrapped in Layout
- Controllers that need auth call `this._app.use("*", requireAuth())` in their constructor
- The Layout receives `user` and `currentPath` from the renderer

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
