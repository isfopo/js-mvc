-- 002_seed_data.sql
-- Seed data for local development. Uses INSERT OR IGNORE to be idempotent.

-- Users (simulated GitHub profiles)
INSERT OR IGNORE INTO users (id, github_id, login, avatar_url, name, created_at, last_login_at)
VALUES
  (1, 1001, 'alice',   'https://avatars.githubusercontent.com/u/1001', 'Alice Chen',    '2025-01-15 09:00:00', '2025-06-01 14:30:00'),
  (2, 1002, 'bob',     'https://avatars.githubusercontent.com/u/1002', 'Bob Martinez',  '2025-01-20 10:00:00', '2025-06-01 12:00:00'),
  (3, 1003, 'carol',   'https://avatars.githubusercontent.com/u/1003', 'Carol Nguyen',  '2025-02-01 11:00:00', '2025-05-28 16:45:00'),
  (4, 1004, 'dave',    'https://avatars.githubusercontent.com/u/1004', 'Dave Kim',      '2025-02-10 08:30:00', '2025-06-01 09:15:00');

-- Tenet 1: Accepted — Use Hono as the web framework
INSERT OR IGNORE INTO tenets (id, title, slug, status, context, decision, rationale, proposed_by_id, created_at, updated_at)
VALUES (
  1,
  'Use Hono as the web framework',
  'use-hono-web-framework',
  'accepted',
  'We need a lightweight, fast web framework for our Cloudflare Worker that supports JSX server-side rendering and has a small bundle size.',
  'Use Hono with hono/jsx for server-side rendering.',
  'Hono is purpose-built for edge runtimes, has excellent TypeScript support, and its JSX engine is compatible with our MVC architecture. Alternatives like Express are too heavy for Workers, and Fresh/Next.js add unnecessary complexity for a Worker-based app.',
  1,
  '2025-03-01 10:00:00',
  '2025-03-15 14:00:00'
);

INSERT OR IGNORE INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
VALUES
  (1, 'Hono', 'Lightweight web framework for edge runtimes', 'Fast, small bundle, great TS support, JSX built-in', 'Smaller community than Express', 0),
  (1, 'Express', 'Mature Node.js web framework', 'Huge ecosystem, well-known, lots of middleware', 'Too heavy for Workers, no native JSX', 1),
  (1, 'itty-router', 'Minimal router for Workers', 'Tiny, simple API', 'No built-in rendering, no middleware system', 2);

-- Tenet 2: Implemented — Use D1 for persistence
INSERT OR IGNORE INTO tenets (id, title, slug, status, context, decision, rationale, proposed_by_id, created_at, updated_at)
VALUES (
  2,
  'Use Cloudflare D1 for persistence',
  'use-cloudflare-d1-persistence',
  'implemented',
  'We need a relational database that runs at the edge alongside our Workers, with low latency and no external network calls.',
  'Use Cloudflare D1 (SQLite-compatible) as the primary data store.',
  'D1 runs in the same isolate as the Worker, eliminating network latency. SQLite compatibility means we can use familiar SQL. KV and R2 don''t support relational queries.',
  2,
  '2025-03-05 09:00:00',
  '2025-04-01 11:00:00'
);

INSERT OR IGNORE INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
VALUES
  (2, 'Cloudflare D1', 'SQLite-compatible edge database', 'Zero latency, SQL familiar, built-in backups', 'SQLite limitations, 500MB limit per DB', 0),
  (2, 'PlanetScale', 'Serverless MySQL', 'MySQL compatible, branching, great DX', 'External network calls, higher latency, costs', 1),
  (2, 'Turso', 'Edge SQLite with libSQL', 'SQLite compatible, edge replicas, branching', 'Third-party dependency, less integrated', 2);

-- Tenet 3: Voting — Adopt CSS Modules for component styling
INSERT OR IGNORE INTO tenets (id, title, slug, status, context, decision, rationale, proposed_by_id, created_at, updated_at)
VALUES (
  3,
  'Adopt CSS Modules for component styling',
  'adopt-css-modules-styling',
  'voting',
  'Our components need scoped styles that don''t leak globally. We currently use Pico CSS for base styles but need a strategy for custom component layouts.',
  NULL,
  NULL,
  3,
  '2025-05-20 15:00:00',
  '2025-05-25 10:00:00'
);

INSERT OR IGNORE INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
VALUES
  (3, 'CSS Modules', 'Scoped CSS via .module.css files', 'Automatic scoping, no runtime cost, works with Vite', 'No dynamic styles, separate files', 0),
  (3, 'Tailwind CSS', 'Utility-first CSS framework', 'Rapid prototyping, consistent design tokens', 'Large config, verbose HTML, learning curve', 1),
  (3, 'Styled Components', 'CSS-in-JS with tagged templates', 'Dynamic styles, co-located with components', 'Runtime overhead, SSR complexity', 2);

-- Tenet 4: Draft — Use Zod for runtime validation
INSERT OR IGNORE INTO tenets (id, title, slug, status, context, decision, rationale, proposed_by_id, created_at, updated_at)
VALUES (
  4,
  'Use Zod for runtime request validation',
  'use-zod-runtime-validation',
  'draft',
  'Form submissions and API requests need runtime validation. Our current IValidatable pattern requires hand-written validate() methods for each request type.',
  NULL,
  NULL,
  4,
  '2025-06-01 08:00:00',
  '2025-06-01 08:00:00'
);

INSERT OR IGNORE INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
VALUES
  (4, 'Zod', 'TypeScript-first schema validation', 'Type inference, composable, great error messages', 'Bundle size (~13KB), new dependency', 0),
  (4, 'Keep IValidatable', 'Current hand-written validation pattern', 'No new deps, full control, zero bundle cost', 'Boilerplate, no type inference, error-prone', 1),
  (4, 'Valibot', 'Modular validation library', 'Tiny bundle (~1KB), tree-shakeable, similar API to Zod', 'Newer, smaller community', 2);

-- Votes for Tenet 1 (accepted — majority approve)
INSERT OR IGNORE INTO votes (tenet_id, user_id, choice, reason, created_at, updated_at)
VALUES
  (1, 1, 'approve', 'Hono is the right fit for Workers.', '2025-03-05 10:00:00', '2025-03-05 10:00:00'),
  (1, 2, 'approve', 'Agreed — lightweight and fast.', '2025-03-06 09:00:00', '2025-03-06 09:00:00'),
  (1, 3, 'approve', NULL, '2025-03-07 11:00:00', '2025-03-07 11:00:00'),
  (1, 4, 'abstain', 'No strong opinion, trusting the team.', '2025-03-08 14:00:00', '2025-03-08 14:00:00');

-- Votes for Tenet 2 (implemented — unanimous approve)
INSERT OR IGNORE INTO votes (tenet_id, user_id, choice, reason, created_at, updated_at)
VALUES
  (2, 1, 'approve', 'D1 is the obvious choice for Workers.', '2025-03-10 10:00:00', '2025-03-10 10:00:00'),
  (2, 2, 'approve', 'Zero latency is critical.', '2025-03-11 09:00:00', '2025-03-11 09:00:00'),
  (2, 3, 'approve', NULL, '2025-03-12 11:00:00', '2025-03-12 11:00:00'),
  (2, 4, 'approve', 'PlanetScale latency would kill us.', '2025-03-12 15:00:00', '2025-03-12 15:00:00');

-- Votes for Tenet 3 (voting — mixed, still open)
INSERT OR IGNORE INTO votes (tenet_id, user_id, choice, reason, created_at, updated_at)
VALUES
  (3, 1, 'approve', 'CSS Modules keep things simple.', '2025-05-22 10:00:00', '2025-05-22 10:00:00'),
  (3, 3, 'approve', 'Scoped styles are essential.', '2025-05-23 09:00:00', '2025-05-23 09:00:00'),
  (3, 4, 'block', 'Tailwind would be faster for prototyping. CSS Modules add file overhead.', '2025-05-24 14:00:00', '2025-05-24 14:00:00');
