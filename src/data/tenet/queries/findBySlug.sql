---
params:
  slug: string
result: Tenet
---
SELECT * FROM tenets WHERE slug = @slug
