# AGENTS.md — js-mvc

## Project

Cloudflare Worker using **Hono** with server-side JSX (`hono/jsx`). MVC architecture.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Deploy | `npm run deploy` |
| Build (for preview) | `npm run build` |
| Preview build | `npm run preview` |
| Generate Cloudflare binding types | `npm run cf-typegen` |
| Build CSS only | `npm run build:css` |

No linter, formatter, or test framework yet.

### CSS Build Process

The CSS build is **automatic** with full HMR support:

1. **Development** (`npm run dev`):
   - CSS builds once at startup
   - Vite watches `src/styles/**/*.css` and `src/views/components/**/*.module.css` files
   - On save: CSS rebuilds + Layout HMR updates instantly
   
2. **Production build** (`npm run build`): CSS builds, then Vite bundles

3. **Deploy** (`npm run deploy`): CSS builds → Vite builds → Wrangler deploys

**When to manually run `npm run build:css`:**
- To verify CSS output without starting the dev server
- In CI/CD pipelines if you need the CSS files before the main build

## Architecture

- **Entry point:** `src/index.tsx` — creates the `Hono` app, mounts controllers, and defines the root route directly.
- **Controllers** (`src/controllers/`): Each controller extends `ControllerBase`, sets an override `base` string (the route prefix), and declares routes via decorators (see **Routing Convention** below). New controllers must be registered in `controllers/index.ts`.
- **Views** (`src/views/`):
  - `pages/` — top-level page components
  - `components/` — reusable UI pieces
  - `shared/` — shared layouts and wrappers (e.g. `Layout.tsx`)
  - Use `FC` from `hono/jsx` with a typed `ViewModel` interface.
- **Styles** (`src/styles/`):
  - `variables.css` - CSS custom properties (colors, typography, spacing)
  - `themes.css` - Light and dark color schemes
  - `reset.css` - Box-sizing, document/landmark base styles
  - `typography.css` - Headings, paragraphs, lists, blockquotes, links
  - `buttons.css` - Button elements
  - `forms.css` - Inputs, selects, textareas, labels, fieldsets, validation
  - `forms-checks.css` - Checkboxes, radios, switches
  - `forms-special.css` - Color, datetime, file, range, search inputs
  - `tables.css` - Table styles
  - `media.css` - Images, video, audio, svg, iframe, figure
  - `code.css` - Code blocks and inline code
  - `layout.css` - Cards, accordion, groups, nav, modal, progress, tooltips, loading
  - `misc.css` - HR, hidden, template, canvas
  - `accessibility.css` - ARIA helpers, RTL, reduced motion
  - Build process recursively discovers all `.css` files in `src/styles/` (excluding `public/`)
  - Component styles use CSS Modules: `src/views/components/{Component}/index.module.css`
  - Components import their CSS Module (`import styles from "./index.module.css"`) and use scoped class names
  - The build script scopes `.module.css` classes automatically (e.g., `.alert` → `Alert_alert`)
  - All styles are combined into a single global bundle at `public/styles/index.css`
  - Edit source files, then `npm run build:css` to regenerate
  - To add a new component with scoped styles, create `src/views/components/{Component}/index.tsx` and `index.module.css`

## Component Philosophy

- **Components should be minimal.** Only add the CSS necessary to make the component functional or to express its specific semantics. Everything else falls back to Pico defaults.
- **Prefer semantic HTML.** Use native elements (`<button>`, `<h1>`, `<p>`, `<table>`, `<input>`, etc.) directly whenever possible. Do not create a component just to wrap a single semantic element.
- **Create components only when semantic HTML is insufficient.** Good reasons include: composite structures (e.g., a dashboard widget with header/chart/legend), stateful variants (e.g., alert with info/success/warning/error states), or reusable layouts that Pico does not provide.
- **CSS Modules scope the minimum.** A component's `index.module.css` should define only its custom properties and layout overrides. Typography, spacing, color, and form styling are inherited from Pico.

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

## Layout / Rendering

Controllers can wrap every route response in a layout automatically. Set it in the constructor:

```ts
class MyController extends ControllerBase {
  override base = "my";

  constructor() {
    super();
  }

  @Get("/")
  index(c: Context) {
    return c.render(<p>Content only — Layout is applied automatically</p>);
  }
}
```

- Call `this.setLayout(Layout)` once per controller to enable auto-wrapping.
- Use `c.render(<View />)` instead of `c.html(<Layout><View /></Layout>)`.
- Controllers without a layout set fall back to returning raw `Response` objects.
- Layout components receive `{ children }` and optionally `head` props.

## Conventions

- `"type": "module"` in package.json — always use ESM imports.
- `noImplicitOverride: true` in tsconfig — `override` keyword required on derived class members.
- `wrangler.jsonc` uses JSON-with-comments format; do not strip comments when editing.
- `worker-configuration.d.ts` is auto-generated by `npm run cf-typegen`; do not hand-edit.
- Decorators follow the **Stage 3 TC39 proposal** (not `experimentalDecorators`).
  `reflect-metadata` is **not** used — metadata is stored via `context.metadata`
  and read back via `Constructor[Symbol.metadata]`. A `Symbol.metadata` polyfill
  is included in `ControllerBase.tsx` for environments that lack it.


