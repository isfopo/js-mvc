import { describe, it, expect } from "vitest";
import {
  tableNameToTypeName,
  generateDbTypesContent,
} from "./generate-db-types";
import type { TableDef } from "./parse-migrations";

describe("singularize (via tableNameToTypeName)", () => {
  it("handles -s", () => {
    expect(tableNameToTypeName("users")).toBe("User");
    expect(tableNameToTypeName("posts")).toBe("Post");
  });

  it("handles -es", () => {
    expect(tableNameToTypeName("boxes")).toBe("Box");
    expect(tableNameToTypeName("foxes")).toBe("Fox");
  });

  it("handles -ies", () => {
    expect(tableNameToTypeName("categories")).toBe("Category");
    expect(tableNameToTypeName("companies")).toBe("Company");
  });

  it("handles -ses, -xes, -zes, -ches, -shes", () => {
    expect(tableNameToTypeName("classes")).toBe("Class");
    expect(tableNameToTypeName("buses")).toBe("Bus");
    expect(tableNameToTypeName("wishes")).toBe("Wish");
    expect(tableNameToTypeName("matches")).toBe("Match");
  });

  it("handles -sses (addresses, classes)", () => {
    expect(tableNameToTypeName("addresses")).toBe("Address");
    expect(tableNameToTypeName("classes")).toBe("Class");
  });

  it("handles -oes (potatoes, tomatoes)", () => {
    expect(tableNameToTypeName("potatoes")).toBe("Potato");
    expect(tableNameToTypeName("tomatoes")).toBe("Tomato");
  });

  it("handles -ves (wolves, calves, shelves)", () => {
    // -ves → -f works for most cases
    expect(tableNameToTypeName("wolves")).toBe("Wolf");
    expect(tableNameToTypeName("calves")).toBe("Calf");
    expect(tableNameToTypeName("shelves")).toBe("Shelf");
  });

  it("handles -ives (knives, lives, wives)", () => {
    // -ives → -ife (must be checked before general -ves rule)
    expect(tableNameToTypeName("knives")).toBe("Knife");
    expect(tableNameToTypeName("lives")).toBe("Life");
    expect(tableNameToTypeName("wives")).toBe("Wife");
  });

  it("doesn't singularize words ending in ss/us/is", () => {
    expect(tableNameToTypeName("status")).toBe("Status");
    expect(tableNameToTypeName("analysis")).toBe("Analysis");
    expect(tableNameToTypeName("bus")).toBe("Bus");
  });

  it("converts snake_case to PascalCase", () => {
    expect(tableNameToTypeName("user_profiles")).toBe("UserProfile");
    expect(tableNameToTypeName("tenet_options")).toBe("TenetOption");
  });

  it("uses overrides when provided", () => {
    const overrides = { people: "Person", children: "Child" };
    expect(tableNameToTypeName("people", overrides)).toBe("Person");
    expect(tableNameToTypeName("children", overrides)).toBe("Child");
  });

  it("singularizes after PascalCase conversion", () => {
    expect(tableNameToTypeName("tenets")).toBe("Tenet");
    expect(tableNameToTypeName("votes")).toBe("Vote");
  });
});

describe("generateDbTypesContent", () => {
  it("generates correct interfaces", () => {
    const tables: TableDef[] = [
      {
        name: "users",
        columns: [
          {
            name: "id",
            sqliteType: "INTEGER",
            notNull: true,
            isPrimaryKey: true,
            checkValues: null,
          },
          {
            name: "name",
            sqliteType: "TEXT",
            notNull: true,
            isPrimaryKey: false,
            checkValues: null,
          },
          {
            name: "email",
            sqliteType: "TEXT",
            notNull: false,
            isPrimaryKey: false,
            checkValues: null,
          },
        ],
      },
    ];

    const content = generateDbTypesContent(tables);

    expect(content).toContain("export interface User {");
    expect(content).toContain("id: number;");
    expect(content).toContain("name: string;");
    expect(content).toContain("email: string | null;");
  });

  it("generates union types for CHECK IN", () => {
    const tables: TableDef[] = [
      {
        name: "tenets",
        columns: [
          {
            name: "id",
            sqliteType: "INTEGER",
            notNull: true,
            isPrimaryKey: true,
            checkValues: null,
          },
          {
            name: "status",
            sqliteType: "TEXT",
            notNull: true,
            isPrimaryKey: false,
            checkValues: ["draft", "voting", "accepted"],
          },
        ],
      },
    ];

    const content = generateDbTypesContent(tables);

    expect(content).toContain('"draft" | "voting" | "accepted"');
  });

  it("generates Database interface", () => {
    const tables: TableDef[] = [
      {
        name: "users",
        columns: [
          {
            name: "id",
            sqliteType: "INTEGER",
            notNull: true,
            isPrimaryKey: true,
            checkValues: null,
          },
        ],
      },
      {
        name: "posts",
        columns: [
          {
            name: "id",
            sqliteType: "INTEGER",
            notNull: true,
            isPrimaryKey: true,
            checkValues: null,
          },
        ],
      },
    ];

    const content = generateDbTypesContent(tables);

    expect(content).toContain("export interface Database {");
    expect(content).toContain("users: User;");
    expect(content).toContain("posts: Post;");
  });

  it("generates SQL module declaration", () => {
    const content = generateDbTypesContent([]);

    expect(content).toContain('declare module "*.sql"');
    expect(content).toContain("const sql: string;");
    expect(content).toContain("export default sql;");
  });

  it("maps SQLite types correctly", () => {
    const tables: TableDef[] = [
      {
        name: "test",
        columns: [
          {
            name: "int_col",
            sqliteType: "INTEGER",
            notNull: true,
            isPrimaryKey: false,
            checkValues: null,
          },
          {
            name: "text_col",
            sqliteType: "TEXT",
            notNull: true,
            isPrimaryKey: false,
            checkValues: null,
          },
          {
            name: "real_col",
            sqliteType: "REAL",
            notNull: true,
            isPrimaryKey: false,
            checkValues: null,
          },
          {
            name: "blob_col",
            sqliteType: "BLOB",
            notNull: true,
            isPrimaryKey: false,
            checkValues: null,
          },
        ],
      },
    ];

    const content = generateDbTypesContent(tables);

    expect(content).toContain("int_col: number;");
    expect(content).toContain("text_col: string;");
    expect(content).toContain("real_col: number;");
    expect(content).toContain("blob_col: ArrayBuffer;");
  });
});
