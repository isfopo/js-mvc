// D1Database already satisfies the Database interface — no adapter code required.
// This file exists for discoverability and future adapter documentation.
//
// Usage:
//   import type { D1Database } from "js-mvc/adapters/d1";
//   import type { Database } from "js-mvc/types";
//
//   // D1Database is structurally compatible with Database
//   const db: Database = env.DB; // works directly

export type { D1Database } from "@cloudflare/workers-types";
