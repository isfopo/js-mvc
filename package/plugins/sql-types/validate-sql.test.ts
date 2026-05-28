import { describe, it, expect } from "vitest";
import { validateSql } from "./validate-sql";
import type { SqlFrontMatter } from "./parse-front-matter";

describe("validateSql", () => {
  const knownTypes = new Set(["Tenet", "User", "Vote", "TenetOption", "TenetStatus"]);

  describe("SQL syntax validation", () => {
    it("validates correct SELECT syntax", () => {
      const sql = "SELECT * FROM tenets WHERE slug = @slug";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string" },
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates correct INSERT syntax", () => {
      const sql =
        "INSERT INTO tenet_options (tenet_id, title) VALUES (@tenetId, @title)";
      const frontMatter: SqlFrontMatter = {
        params: { tenetId: "number", title: "string" },
        result: "void",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates correct UPDATE syntax", () => {
      const sql = "UPDATE tenets SET status = @status WHERE id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { id: "number", status: "TenetStatus" },
        result: "void",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates correct DELETE syntax", () => {
      const sql = "DELETE FROM tenets WHERE id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { id: "number" },
        result: "void",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("catches SQL syntax errors", () => {
      const sql = "SELECTT * FROM tenets"; // typo: SELECTT
      const frontMatter: SqlFrontMatter = { result: "Tenet" };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("SQL syntax error");
    });
  });

  describe("placeholder extraction", () => {
    it("extracts @paramName placeholders", () => {
      const sql = "SELECT * FROM tenets WHERE slug = @slug AND id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string", id: "number" },
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.placeholders).toEqual(["slug", "id"]);
    });

    it("handles repeated placeholders", () => {
      const sql =
        "SELECT * FROM tenets WHERE slug = @slug OR slug = @slug";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string" },
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      // Should only list unique placeholders
      expect(result.placeholders).toEqual(["slug"]);
    });

    it("handles SQL with no placeholders", () => {
      const sql = "SELECT * FROM tenets";
      const frontMatter: SqlFrontMatter = { result: "Tenet" };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.placeholders).toEqual([]);
    });
  });

  describe("params validation", () => {
    it("warns when SQL uses placeholder not in params", () => {
      const sql = "SELECT * FROM tenets WHERE slug = @slug AND id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string" }, // missing id
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toContain(
        "SQL uses @id but it's not declared in params:",
      );
    });

    it("warns when params declares param not used in SQL", () => {
      const sql = "SELECT * FROM tenets WHERE slug = @slug";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string", unused: "number" }, // unused param
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toContain(
        "params: declares unused but it's not used in SQL",
      );
    });

    it("no warnings when params match placeholders", () => {
      const sql = "SELECT * FROM tenets WHERE slug = @slug AND id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { slug: "string", id: "number" },
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("result type validation", () => {
    it("warns when result references unknown type", () => {
      const sql = "SELECT * FROM unknown_table";
      const frontMatter: SqlFrontMatter = {
        result: "UnknownType",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toContain(
        'result: references type "UnknownType" which doesn\'t exist in db-types.d.ts or model.ts',
      );
    });

    it("no warning for known types", () => {
      const sql = "SELECT * FROM tenets";
      const frontMatter: SqlFrontMatter = {
        result: "Tenet",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toHaveLength(0);
    });

    it("no warning for void result", () => {
      const sql = "DELETE FROM tenets WHERE id = @id";
      const frontMatter: SqlFrontMatter = {
        params: { id: "number" },
        result: "void",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toHaveLength(0);
    });

    it("validates complex type expressions", () => {
      const sql = "SELECT t.*, u.login FROM tenets t JOIN users u ON u.id = t.proposed_by_id";
      const frontMatter: SqlFrontMatter = {
        result: "Tenet & { proposer_login: string }",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      // Tenet is known, string is primitive — no warnings
      expect(result.warnings).toHaveLength(0);
    });

    it("warns for unknown types in complex expressions", () => {
      const sql = "SELECT * FROM tenets";
      const frontMatter: SqlFrontMatter = {
        result: "Tenet & { extra: UnknownType }",
      };

      const result = validateSql(sql, frontMatter, knownTypes);

      expect(result.warnings).toContain(
        'result: references type "UnknownType" which doesn\'t exist in db-types.d.ts or model.ts',
      );
    });
  });
});
