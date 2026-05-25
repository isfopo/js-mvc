# js-mvc

MVC framework for Cloudflare Workers built on Hono with server-side JSX

---

## Features

- **Decorator-based routing** — Stage 3 TC39 decorators (`@Get`, `@Post`, etc.) on controller methods
- **Guard pipeline** — `@Exists`, `@Authorize`, `@Validate` decorators run before handlers
- **SQL repository layer** — Generic CRUD, dynamic finders, typed `.sql` file queries, injection-safe
- **Client-side handlers** — `Action()` factory wires server JSX to client controllers without manual attributes
- **CSS-only interactivity** — `State()` factory generates scoped CSS rules for show/hide/disable based on form state
- **Vite plugins** — SQL transform, SQL type generation, CSS build, client bundle

---

## Installation

Requires `hono` as a peer dependency.

---

## Quick start

### Controller

```ts
import { ControllerBase, Get, Post } from "js-mvc/controller/ControllerBase"
import { Exists, Validate } from "js-mvc/validation/decorators"
import { MyRequest } from "./requests"

class TenetsController extends ControllerBase {
  override base = "/tenets"

  @Get("/:slug")
  @Exists("tenet", (c) => repo(c.env.DB).findOneBy({ slug: c.req.param("slug")! }))
  async show(c) {
    const tenet = c.get("tenet")
    return c.render(<TenetView tenet={tenet} />)
  }

  @Post("/")
  @Validate(MyRequest)
  async create(c) {
    const input = c.get("validated") as MyRequest
    // ...
  }
}
```

### Repository

```ts
import { RepositoryBase } from "js-mvc/repository/RepositoryBase"

interface Tenet { id: number; slug: string; title: string; status: string }

class TenetRepo extends RepositoryBase<Tenet> {
  override readonly tableName = "tenets"
}

// Per-request factory
const repo = (db) => new TenetRepo(db)

// Usage
const tenet = await repo(db).findOneBy({ slug: "my-tenet" })
const drafts = await repo(db).findAllBy({ status: "draft" })
```

### Client handler

```tsx
import { Action } from "js-mvc/utils/Action"

const Dismiss = Action("dismiss")

<Dismiss>
  <div class="card">
    <p>Notification content</p>
    <Dismiss.Trigger event="click" method="hide">
      <button>Close</button>
    </Dismiss.Trigger>
  </div>
</Dismiss>
```

### CSS-only state

```tsx
import { State } from "js-mvc/utils/State"

const Plan = State<"plan", "free" | "pro">("plan")

<Plan>
  <Plan.Trigger value="free">
    <input type="radio" name="plan" value="free" />
  </Plan.Trigger>
  <Plan.Trigger value="pro">
    <input type="radio" name="plan" value="pro" />
  </Plan.Trigger>
  <Plan.Show when="free">Free tier content</Plan.Show>
  <Plan.Show when="pro">Pro tier content</Plan.Show>
</Plan>
```

---

## Philosophy

### Domain-Driven Design

- **Repository pattern** — `RepositoryBase` abstracts data access behind a domain-facing interface. Controllers and services never touch raw SQL
- **Service layer** — `ServiceBase` holds business logic, shared between HTML and API controllers
- **Request objects** — `IValidatable` encapsulates input validation as domain concepts, not scattered controller checks
- **Per-request factories** — Repos are instantiated per-request (`tenetsRepo(db)`), not shared singletons. No stale state, trivial to test
- **Domain errors** — Typed error hierarchy (`NotFoundError`, `ValidationError`, `ForbiddenError`, `ConflictError`) maps directly to HTTP status codes

### Separation of Concerns

- **Strict MVC layers** — Controllers handle routing/rendering, services handle business rules, repositories handle data access
- **HTML vs API controllers** — Same pattern, different output. Business logic lives in services
- **Server vs client** — `Action()` generates `data-*` attributes server-side; `BaseHandler` consumes them client-side. No manual strings to keep in sync
- **CSS-only vs JS interactivity** — `State()` generates scoped CSS rules. `Action()` wires JS handlers. Choose the right tool per interaction

### Convention Over Configuration

- **Decorator routing** — `@Get("/users")` on a method with `base = "api"` produces `GET /api/users`. No route table
- **Guard pipeline** — `@Exists`, `@Authorize`, `@Validate` stack declaratively. Execution order matches declaration order
- **Generic CRUD** — Extend `RepositoryBase<T>`, declare `tableName`, inherit `findById`, `findAll`, `create`, `update`, `delete`, `count`
- **Dynamic finders** — `findOneBy({ slug })`, `findAllBy({ status })`. No query builder, no ORM DSL

### Small Deliveries

- **Thin base classes** — `ServiceBase` is 46 lines. `ControllerBase` is 161 lines. Each does one thing well
- **No heavy ORM** — Parameterized SQL with injection guards. Complex queries live in `.sql` files
- **No frontend framework** — `hono/jsx` for server rendering. Lightweight client handler dispatcher. No hydration, no bundle bloat
- **No magic** — Decorators store metadata on `Symbol.metadata`, read back explicitly. No reflection, no runtime code generation

### Developer Experience

- **Declarative over imperative** — `@Validate(Request)` instead of manual checks. `Action("dismiss")` instead of hand-written `data-*` attributes
- **Type safety by default** — `noImplicitOverride: true`, generic repositories, typed request objects, Stage 3 decorators
- **Safety nets built in** — Column name validation, ORDER BY validation, empty criteria protection, correct null handling
- **Instant feedback** — Vite HMR for CSS. Layout updates without full reload

---

## Architecture

| Layer | Base class | Purpose |
|---|---|---|
| Controllers | `ControllerBase` | Route handling, rendering, guard execution |
| Services | `ServiceBase` | Business logic, validation helpers |
| Repositories | `RepositoryBase` | Data access, CRUD, typed SQL queries |
| Client handlers | `BaseHandler` | DOM event wiring, target resolution |

### Request flow

1. Decorators collect route metadata on the class via `Symbol.metadata`
2. `ControllerBase.register()` reads metadata and mounts routes on Hono
3. Guards execute in declaration order before the handler
4. `c.render()` wraps JSX in the shared layout

---

## API reference

### Exports

| Subpath | What it provides |
|---|---|
| `js-mvc/controller/ControllerBase` | `ControllerBase`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch` |
| `js-mvc/repository/RepositoryBase` | `RepositoryBase` with CRUD and dynamic finders |
| `js-mvc/service/ServiceBase` | `ServiceBase` with error helpers |
| `js-mvc/validation/decorators` | `@Exists`, `@Authorize`, `@Validate` |
| `js-mvc/validation/IValidatable` | `IValidatable` interface for request objects |
| `js-mvc/errors` | `AppError`, `NotFoundError`, `ValidationError`, etc. |
| `js-mvc/utils/Action` | `Action()` factory for client handlers |
| `js-mvc/utils/State` | `State()` factory for CSS-only interactivity |
| `js-mvc/client/BaseHandler` | `BaseHandler` for custom client controllers |
| `js-mvc/client/dispatcher` | Client-side handler dispatcher |
| `js-mvc/adapters/d1` | Cloudflare D1 database adapter |
| `js-mvc/plugins` | Vite plugins (`sqlTransformPlugin`, `sqlTypesPlugin`, `cssBuildPlugin`, `clientBuildPlugin`) |

---

## Security

### Column name validation

All repository methods that build SQL from object keys validate column names against `/^[a-zA-Z_]\w*$/`:

```ts
// Safe
await repo.findOneBy({ slug: "my-tenet" })

// Throws: Unsafe column name: "123abc"
await repo.findOneBy({ "123abc": "value" } as any)
```

### ORDER BY validation

`findAll({ orderBy })` rejects clauses containing SQL keywords:

```ts
await repo.findAll({ orderBy: "created_at DESC" })  // OK
await repo.findAll({ orderBy: "id; DROP TABLE x" }) // Throws
```

### Empty criteria protection

Dynamic finders reject empty objects to prevent accidental full-table operations:

```ts
await repo.findOneBy({}) // Throws
```

---

## Decorators

### Route decorators

```ts
@Get("/")          // GET /base
@Post("/users")    // POST /base/users
@Put("/users/:id") // PUT /base/users/:id
@Delete("/users")  // DELETE /base/users
```

### Guard decorators

Stack guards above handlers. They execute in declaration order:

```ts
@Get("/:id")
@Exists("user", (c) => usersRepo(c.env.DB).findById(Number(c.req.param("id"))))
@Authorize((c) => {
  if (c.get("user").role !== "admin") throw new ForbiddenError()
})
async adminView(c) {
  const user = c.get("user") // loaded by @Exists
  // ...
}
```

---

## Vite plugins

```ts
import { sqlTransformPlugin, sqlTypesPlugin, cssBuildPlugin, clientBuildPlugin } from "js-mvc/plugins"

export default {
  plugins: [
    sqlTransformPlugin(),
    sqlTypesPlugin({ sqlDir: "./src/data/requests" }),
    cssBuildPlugin({ entry: "./src/styles/app.css" }),
    clientBuildPlugin({ entry: "./src/client/main.ts" }),
  ],
}
```

---

## TypeScript

The package uses `noImplicitOverride: true` and Stage 3 decorators. Your `tsconfig.json` should include:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "noImplicitOverride": true
  }
}
```
