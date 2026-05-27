# Feature-Colocated (Flat) vs. Layered (Vertical) Structure

## Current: Vertical Structure

```
src/
  controllers/
    ControllerBase.tsx
    index.ts
    HomeController.tsx
    ComponentsController.tsx
    WellKnownController.tsx
  view-builders/
    HomeViewBuilder.ts
  view-models/
    HomeViewModel.ts
  views/
    pages/
      Home.tsx
      Components.tsx
    components/
      Action.tsx
      Alert/
        index.tsx
        index.module.css
    shared/
      Layout.tsx
      Results.tsx
  client/
    handlers/*
    dispatcher.ts
    main.ts
    types.d.ts
  errors/
    index.tsx
  index.tsx
```

**To modify a single page (Home), you open 4 separate directories:**

```
src/controllers/HomeController.tsx
src/view-builders/HomeViewBuilder.ts
src/view-models/HomeViewModel.ts
src/views/pages/Home.tsx
```

---

## Proposed: Flat (Feature-Colocated) Structure

```
src/
  pages/
    Home/
      controller.tsx          ← was controllers/HomeController.tsx
      view.tsx                ← was views/pages/Home.tsx
      view-model.ts           ← was view-models/HomeViewModel.ts
      view-builder.ts         ← was view-builders/HomeViewBuilder.ts
      client.ts               ← client-side JS for this page (optional)
    Components/
      controller.tsx          ← was controllers/ComponentsController.tsx
      view.tsx                ← was views/pages/Components.tsx
    WellKnown/
      controller.tsx          ← was controllers/WellKnownController.tsx
  components/                 ← shared/reusable UI components
    Action.tsx
    Alert/
      index.tsx
      index.module.css
  layouts/                    ← was views/shared/
    Layout.tsx
    Results.tsx
  infrastructure/             ← base classes, framework wiring
    ControllerBase.tsx
    controllers/index.ts      ← registration of all page controllers
    errors/index.tsx
  client/                     ← global client code
    handlers/*
    dispatcher.ts
    main.ts
    types.d.ts
  index.tsx
```

**To modify the Home page, you open one folder:**

```
src/pages/Home/
```

---

## What This Looks Like in Practice

### `src/pages/Home/controller.tsx`

```tsx
import { Context, Env } from "hono";
import { Get, ControllerBase } from "../../infrastructure/ControllerBase";
import { viewBuilder } from "./view-builder";
import { View } from "./view";

class HomeController<T extends Env> extends ControllerBase<T> {
  override base = "home";

  @Get("/")
  index({ render }: Context) {
    return render(<View {...viewBuilder.index()} />);
  }
}

export default new HomeController();
```

### `src/pages/Home/view.tsx`

```tsx
import type { FC } from "hono/jsx";
import type { HomeViewModel } from "./view-model";

export const View: FC<HomeViewModel> = ({ today }) => {
  return <p>Hi! It's {today.toDateString()}</p>;
};
```

### `src/pages/Home/view-model.ts`

```ts
export interface HomeViewModel {
  today: Date;
}
```

### `src/pages/Home/view-builder.ts`

```ts
import type { HomeViewModel } from "./view-model";

export const viewBuilder = {
  index(): HomeViewModel {
    return { today: new Date() };
  },
};
```

### Registration (`src/infrastructure/controllers/index.ts`)

```ts
import { Env, Hono } from "hono";
import HomeController from "../../pages/Home/controller";
import ComponentsController from "../../pages/Components/controller";
import WellKnownController from "../../pages/WellKnown/controller";

export const registerControllers = <T extends Env>(app: Hono<T>) => {
  HomeController.register(app);
  ComponentsController.register(app);
  WellKnownController.register(app);
};
```

---

## Tradeoff Analysis

### ✅ Gains

| Aspect | Why it's better |
|---|---|
| **Locality of change** | All files for one page live in one folder. When iterating on Home, you never leave `src/pages/Home/`. |
| **AI context efficiency** | AI tools see all relevant files in one directory scan. No need to infer connections across 4 distant folders. |
| **Onboarding** | New dev sees "here's a page" — all its concerns are right there. |
| **Deletion** | Want to remove the Home page? `rm -rf src/pages/Home`. No hunting for orphaned files in 4 directories. |
| **Naming** | Files can be generic (`controller.tsx`, `view.tsx`) since the folder name provides the context. No need for `HomeController`, `HomeViewModel` prefixes. |
| **Scoped imports** | Imports within a page are relative (`./view-model`). Cross-page coupling is explicit and visible. |
| **Client handlers** | Page-specific JS lives next to its server code. Only truly global client code goes in `src/client/`. |

### ❌ Costs

| Aspect | Why it's worse |
|---|---|
| **Route discovery** | You can't look at one `controllers/` directory to see all routes. You need to scan `pages/*/controller.tsx` or rely on the registration file. |
| **Shared infrastructure is less visible** | `ControllerBase`, errors, and layout are now in an `infrastructure/` directory — they feel more "hidden" than top-level `controllers/ControllerBase.tsx`. |
| **File name uniformity** | Every page has a `controller.tsx`, `view.tsx`, etc. If you open many tabs in your editor, they all say `controller.tsx`. This is the biggest practical friction. Mitigation: your editor shows the full path, or you use `Ctrl+P` / fuzzy finder. |
| **Registration boilerplate** | Each new page must be added to `infrastructure/controllers/index.ts`. Slightly more discoverable than auto-registration, but one more step. A convention-based scanner (`readdirSync("pages")`) could eliminate this — at the cost of magic. |
| **Shared page components** | Where does a component used by only 2 pages go? In `components/` (shared) or duplicated? Boundary decisions become fuzzier. |
| **Refactoring cost** | Moving from vertical to flat is a pure file-move exercise (no logic changes) — but it touches every file in the project. Git history gets noisy. |

---

## The Naming Friction (and a Mitigation)

The "all files named `controller.tsx`" problem is real. Some projects adopt a suffix convention:

```
src/pages/Home/
  HomeController.tsx
  HomeView.tsx
  HomeViewModel.ts
  HomeViewBuilder.ts
```

But that's the **worst of both worlds** — you still type the prefix, and the folder name is redundant. The flat structure works best when you trust your editor's fuzzy finder:

- `Cmd+P` → `pages/Home/cont` → `src/pages/Home/controller.tsx`
- `Cmd+P` → `pages/Home/view` → `src/pages/Home/view.tsx`

Or use column-width file names and rely on the tab showing the full path. Some teams solve this with a `barrel file`:

```ts
// src/pages/Home/index.ts
export { default as controller } from "./controller";
export { View } from "./view";
export type { HomeViewModel } from "./view-model";
export { viewBuilder } from "./view-builder";
```

---

## A Middle Ground: Nested Modules

Another approach keeps some layering but groups by feature within each layer:

```
src/
  pages/
    Home.controller.tsx
    Home.view.tsx
    Home.view-model.ts
    Home.view-builder.ts
    Components.controller.tsx
    Components.view.tsx
    WellKnown.controller.tsx
  components/
    Action.tsx
    Alert/
  layouts/
    Layout.tsx
    Results.tsx
  infrastructure/
    ControllerBase.tsx
    controllers/index.ts
    errors/index.tsx
  client/
    ...
  index.tsx
```

This is **flat in the directory listing** — all pages are files in one directory, named by feature. You lose the folder grouping but gain single-click access to all page files in one view. `Cmd+P` → `Home.view` finds it instantly.

---

## Verdict

**The flat structure wins for this codebase**, for one dominant reason: **the app is page-oriented**. Each page has a controller, a view, a view-model, and a view-builder. That's a fixed 4-file pattern per page. The vertical structure makes you context-switch across 4 directories every time you touch a page. The flat structure makes the page the unit of organization.

The costs are real but manageable:
- **Route discovery** — the registration file is still centralized
- **All-controller.tsx tabs** — fuzzy finder or full-path display solves this
- **Git history noise** — one-time cost to move

The .NET-style vertical layering made sense when pages had one code-behind file and the framework was the architecture. Here, your `ControllerBase` and decorators *are* the architecture — the folder layout should serve the developer, not mirror the framework.

**The nested-modules middle ground** (all page files in `src/pages/`, prefixed by feature name) is a good pragmatic option if you want to keep the directory flat without nested subfolders. It avoids the "all `controller.tsx`" tab problem while still keeping all Home files adjacent.
