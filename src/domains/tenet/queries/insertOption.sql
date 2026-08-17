---
params:
  tenetId: number
  title: string
  description: "string | null"
  pros: "string | null"
  cons: "string | null"
  sortOrder: number
result: void
---
INSERT INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
VALUES (@tenetId, @title, @description, @pros, @cons, @sortOrder)
