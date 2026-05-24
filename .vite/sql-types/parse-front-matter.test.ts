import { describe, it, expect } from "vitest";
import { parseFrontMatter } from "./parse-front-matter";

describe("parseFrontMatter", () => {
  it("parses params and result", () => {
    const content = `---
params:
  slug: string
  id: number
result: Tenet
---
SELECT * FROM tenets WHERE slug = @slug AND id = @id`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toEqual({
      slug: "string",
      id: "number",
    });
    expect(data.result).toBe("Tenet");
    expect(sql).toBe("SELECT * FROM tenets WHERE slug = @slug AND id = @id");
  });

  it("handles missing params", () => {
    const content = `---
result: Tenet
---
SELECT * FROM tenets`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toBeUndefined();
    expect(data.result).toBe("Tenet");
    expect(sql).toBe("SELECT * FROM tenets");
  });

  it("handles missing result", () => {
    const content = `---
params:
  id: number
---
DELETE FROM tenets WHERE id = @id`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toEqual({ id: "number" });
    expect(data.result).toBeUndefined();
    expect(sql).toBe("DELETE FROM tenets WHERE id = @id");
  });

  it("handles no front matter", () => {
    const content = `SELECT * FROM tenets WHERE id = 1`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toBeUndefined();
    expect(data.result).toBeUndefined();
    expect(sql).toBe("SELECT * FROM tenets WHERE id = 1");
  });

  it("handles empty front matter", () => {
    const content = `---
---
SELECT * FROM tenets`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toBeUndefined();
    expect(data.result).toBeUndefined();
    expect(sql).toBe("SELECT * FROM tenets");
  });

  it("handles complex type expressions", () => {
    const content = `---
result: "Tenet & { proposer_login: string, proposer_avatar: string | null }"
---
SELECT t.*, u.login AS proposer_login FROM tenets t JOIN users u ON u.id = t.proposed_by_id`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.result).toBe(
      "Tenet & { proposer_login: string, proposer_avatar: string | null }",
    );
    expect(sql).toContain("SELECT t.*");
  });

  it("handles void result type", () => {
    const content = `---
params:
  id: number
  status: TenetStatus
result: void
---
UPDATE tenets SET status = @status WHERE id = @id`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.result).toBe("void");
    expect(data.params).toEqual({
      id: "number",
      status: "TenetStatus",
    });
    expect(sql).toContain("UPDATE tenets");
  });

  it("handles nullable param types", () => {
    const content = `---
params:
  description: "string | null"
  pros: "string | null"
result: void
---
INSERT INTO options (description, pros) VALUES (@description, @pros)`;

    const { data, sql } = parseFrontMatter(content);

    expect(data.params).toEqual({
      description: "string | null",
      pros: "string | null",
    });
    expect(sql).toContain("INSERT INTO options");
  });

  it("trims whitespace from SQL", () => {
    const content = `---
result: Tenet
---

  SELECT * FROM tenets  

`;

    const { sql } = parseFrontMatter(content);

    expect(sql).toBe("SELECT * FROM tenets");
  });

  it("throws on invalid params type (string instead of map)", () => {
    const content = `---
params: not_a_map
---
SELECT * FROM tenets`;

    expect(() => parseFrontMatter(content, "test.sql")).toThrow(
      'test.sql: front matter "params" must be a YAML map',
    );
  });

  it("throws on invalid params type (array instead of map)", () => {
    const content = `---
params:
  - slug
  - id
---
SELECT * FROM tenets`;

    expect(() => parseFrontMatter(content, "test.sql")).toThrow(
      'test.sql: front matter "params" must be a YAML map',
    );
  });

  it("throws on invalid param value type", () => {
    const content = `---
params:
  slug: 42
---
SELECT * FROM tenets`;

    expect(() => parseFrontMatter(content, "test.sql")).toThrow(
      'test.sql: front matter param "slug" must be a type string',
    );
  });

  it("throws on invalid result type (number instead of string)", () => {
    const content = `---
result: 42
---
SELECT * FROM tenets`;

    expect(() => parseFrontMatter(content, "test.sql")).toThrow(
      'test.sql: front matter "result" must be a string',
    );
  });
});
