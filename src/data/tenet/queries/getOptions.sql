---
params:
  tenetId: number
result: TenetOption
---
SELECT * FROM tenet_options WHERE tenet_id = @tenetId ORDER BY sort_order
