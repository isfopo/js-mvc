# Custom Router vs. Hono — Analysis

## What Hono Provides in This Codebase

| Import | Used In | Purpose |
|---|---|---|
| `new Hono()` | `ControllerBase`, `index.tsx` | App creation, `.get()`, `.post()`, `.use()`, `.route()` |
| `Context` | Every controller, errors | Request/response wrapper: `c.json()`, `c.html()`, `c.redirect()`, `c.req.param()`, `c.setRenderer()`, `c.status()` |
| `Env` | Every controller | Generic type for Cloudflare bindings |
| `hono/jsx` | All views | JSX runtime (`jsx`, `jsxs`, `Fragment`), `FC`, `JSXNode`, `JSX.IntrinsicElements`, `PropsWithChildren` |
| `hono/jsx/dom/server` | `ControllerBase` | `renderToString` — server-side JSX → HTML |
| `StatusCode` | `errors/index` | HTTP status code type |
| `@cloudflare/vite-plugin` | `vite.config` | Dev server with CF Workers runtime |

Hono is woven into **every layer** of the app. Removing it touches routing, rendering, request handling, error handling, types, and dev tooling.

---

## The Full Process of Replacing Hono

### Phase 1 — The JSX Runtime

`hono/jsx` is a **standalone JSX engine** — it does not depend on the Hono router. You can keep using it:

```ts
// tsconfig.json — this already uses hono/jsx independently
"jsx": "react-jsx",
"jsxImportSource": "hono/jsx",
```

**No change needed here.** Views, components, `renderToString` — they all work without `new Hono()`. This is the easiest win to preserve.

### Phase 2 — The Router (~200 lines)

This is the core piece to replace. Here's what `Hono` does for you:

```ts
// What ControllerBase.register() currently does with Hono
this._app.get("/items/:id", handler);  // URL pattern matching
this._app.use("*", middleware);          // Wildcard middleware
app.route("home", this._app);           // Prefix mounting
```

A minimal homebrew replacement:

```typescript
// src/router/Router.ts — minimal trie-less router

type ParamMap = Record<string, string>;

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: (ctx: RequestContext) => Response | Promise<Response>;
}

export class Router {
  private routes: RouteEntry[] = [];

  get(path: string, handler: Handler) { this.add("GET", path, handler); }
  post(path: string, handler: Handler) { this.add("POST", path, handler); }
  // ... etc

  private add(method: string, path: string, handler: Handler) {
    // Convert "/items/:id" → regex /^\/items\/([^\/]+)$/
    const paramNames: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      paramNames,
      handler,
    });
  }

  match(method: string, url: string): { handler: Handler; params: ParamMap } | null {
    const pathname = new URL(url, "http://localhost").pathname;
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params: ParamMap = {};
      route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { handler: route.handler, params };
    }
    return null;
  }
}
```

**Complexity escalator:**

| Approach | Lines | Performance | Correctness risk |
|---|---|---|---|
| Linear regex scan (above) | ~60 | O(n) routes | Low for < 50 routes |
| Trie-based | ~300 | O(n) path segments | Low |
| Radix tree | ~500+ | O(k) path length | Medium — wildcard/overlap edge cases |

Hono uses a radix tree. For ~6 routes, linear regex scanning is indistinguishable in practice.

### Phase 3 — Request Context (~150 lines)

`Context` from Hono provides a unified interface across platforms. You'd build:

```typescript
export class RequestContext {
  constructor(
    private request: Request,
    public params: Record<string, string> = {},
    public statusCode = 200,
    public headers = new Headers(),
  ) {}

  get req() {
    return {
      param: (name: string) => this.params[name],
      query: (name: string) => new URL(this.request.url).searchParams.get(name),
      header: (name: string) => this.request.headers.get(name),
    };
  }

  status(code: number) { this.statusCode = code; }

  json(data: unknown) {
    return new Response(JSON.stringify(data), {
      status: this.statusCode,
      headers: { "content-type": "application/json", ...this.headers },
    });
  }

  html(html: string) {
    return new Response(html, {
      status: this.statusCode,
      headers: { "content-type": "text/html", ...this.headers },
    });
  }

  redirect(location: string, status = 302) {
    return new Response(null, { status, headers: { location } });
  }
}
```

### Phase 4 — Middleware Pipeline (~80 lines)

```typescript
type Middleware = (ctx: RequestContext, next: () => Promise<Response>) =>
  Response | Promise<Response>;

class Router {
  private globalMiddleware: Middleware[] = [];

  use(fn: Middleware) { this.globalMiddleware.push(fn); }

  async run(request: Request): Promise<Response> {
    const ctx = new RequestContext(request);
    const { handler, params } = this.match(request.method, request.url);
    ctx.params = params ?? {};

    // Build pipeline: global middleware → route handler → error handler
    const pipeline = [
      ...this.globalMiddleware,
      async (c: RequestContext) => {
        try {
          return await handler!(c);
        } catch (err) {
          return handleError(c, err);
        }
      },
    ];

    // Compose middleware chain with next()
    const composed = pipeline.reduceRight(
      (next, mw) => () => mw(ctx, next),
      () => new Response("Not Found", { status: 404 }),
    );

    return composed();
  }
}
```

### Phase 5 — Platform Adapters (~30 lines each)

```typescript
// src/platform/cf.ts
export function createFetchHandler(router: Router) {
  return {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
      return router.run(request);
    },
  };
}

// src/platform/node.ts
import { createServer } from "node:http";
export function serve(router: Router, port: number) {
  createServer(async (req, res) => {
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as any,
    });
    const response = await router.run(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(value);
        pump();
      });
      pump();
    } else {
      res.end();
    }
  }).listen(port);
}
```

### Phase 6 — Adapt ControllerBase (~40 lines delta)

The controller's `register()` method simply swaps `Hono` for your `Router`:

```diff
- import { Context, Env, Hono } from "hono";
+ import { RequestContext } from "../router/RequestContext";
+ import { Router } from "../router/Router";

  export abstract class ControllerBase {
-   _app: Hono<T>;
+   _router = new Router();
    abstract base: string;

    register<E>(app: Router): void {
      const routes = (this.constructor as any)[Symbol.metadata]?.[ROUTES_KEY] ?? [];
      for (const route of routes) {
-       this._app[route.method](route.path, async (c: Context) => { ... });
+       this._router[route.method](route.path, async (c: RequestContext) => { ... });
      }
-     app.route(this.base, this._app);
+     app.mount(this.base, this._router);
    }
  }
```

---

## Limitations of a Homebrew Router

### 1. Performance ceiling

Hono's radix tree router benchmarks at ~1.2M routes/sec. A linear regex scanner (the simplest replacement) benchmarks at ~50K–100K routes/sec with many routes. **For ~5–20 routes, both are forever under 1µs per match — irrelevant.** But if you grow to hundreds of routes, the gap widens.

### 2. Edge-case correctness (the real cost)

Hono has production battle scars you'll need to earn yourself:

| Domain | Example edge case |
|---|---|
| URL encoding | `/items/caf%C3%A9` → param `"café"` |
| Trailing slashes | `/home/` vs `/home` redirect |
| Regex path conflicts | `/posts/:id` vs `/posts/new` ordering |
| Query params | `?a=1&a=2` → `a: ["1", "2"]` |
| Body parsing | `multipart/form-data` boundaries, charset handling |
| Wildcard overlap | `/files/*` vs `/files/:id` |
| Method-not-allowed | `405` with `Allow` header |
| Content negotiation | `Accept` header for `c.html()` vs `c.json()` |

Each edge case took Hono months of issues/PRs to stabilize. Your mileage may vary.

### 3. Dev server complexity

Currently `@cloudflare/vite-plugin` gives you:

```
npm run dev → Vite dev server with CF Workers runtime + HMR + CSS rebuild
```

Without Hono, you'd either:
- **Keep the Cloudflare plugin** (it doesn't require Hono — it wraps any `fetch`-compatible export)
- **Build your own dev server** with `miniflare` or `wrangler dev`
- **Use environment-specific tooling** (`tsx --watch` for Node, `deno run --watch` for Deno)

The Cloudflare Vite plugin works with **any Worker entry point** that exports `{ fetch }`. So you can keep it.

### 4. Ecosystem gaps

Things you lose access to:

| Feature | Hono ecosystem | Custom cost |
|---|---|---|
| CORS | `@hono/cors` | ~20 lines + `OPTIONS` handling |
| JWT auth | `@hono/jwt` | ~50 lines + a library |
| Rate limiting | Custom middleware | ~30 lines |
| Validators | `@hono/validator` | Build yourself or use `zod` |
| RPC client | `@hono/rpc` | Manual `fetch` calls |
| WebSockets | `hono/ws` | Native `WebSocket` API |
| Streaming | `hono/streaming` | `ReadableStream` directly |
| Testing | `app.request("/url")` | Manual `new Request(...)` calls |

None of these are hard — but they add up.

### 5. TypeScript friction

Hono's generics for env bindings (`Hono<{ Bindings: Env }>`) are convenient. You'd need to thread env through your own context:

```typescript
// Custom approach
class RequestContext<E = Record<string, unknown>> {
  constructor(public request: Request, public env: E) {}
}
```

Not hard, but you lose Hono's deep integration with `c.var`, `c.set`/`c.get` for per-request state.

---

## The Verdict

Decision matrix based on this codebase's actual needs:

| Factor | Keep Hono | Replace |
|---|---|---|
| **Bundle size** | +14KB gzipped | −14KB gzipped |
| **Maintenance burden** | You maintain 0 lines | You maintain ~500–800 lines |
| **Route count** (you have ~6) | Fine | Fine — trivial router works |
| **Environment support** | 8+ platforms out of box | You build each adapter |
| **Edge cases** | Solved by thousands of users | You discover them in production |
| **Velocity on new features** | Import middleware, done | Build everything |
| **Learning / fun factor** | Low | High |

### Recommendation: Keep Hono, but scope it down.

Hono is not bloated — it's **14KB** and one of the fastest routers in JS. The MVC framework you're building on top (`ControllerBase`, decorators, layout system) adds genuine architectural value. Replacing Hono with custom code mostly shifts effort from building your app to rebuilding infrastructure.

If bundle size is the concern, note that:
- `hono/jsx` is the bulk — and you'd keep it anyway
- The router itself is tiny
- Tree-shaking eliminates unused parts in production

If platform portability is the concern, Hono is a **net-positive** — it gives you CF Workers, Node, Bun, Deno, Lambda, Supabase, etc. from one codebase. Without it, you'd rebuild a shittier version of the same abstraction.

### The pragmatic middle ground

If you truly want to minimize dependencies while keeping portability, the most impactful change is **not** removing Hono but:

1. **Keep `hono/jsx`** as a standalone rendering dependency (it has no router dependency)
2. **Keep `ControllerBase`** decorator pattern (it's your app's architecture)
3. **Consider `hono/tiny`** — Hono's sub-route import for even smaller bundles
4. **Skip the custom router** — the maintenance cost exceeds the savings for a ~6-route app

The one scenario where a custom router makes sense: if you're building a **general-purpose framework** that others will use, and you want zero third-party dependencies for ideological reasons. But for your application code, Hono's abstraction is already doing exactly what you'd rebuild — and doing it better.
