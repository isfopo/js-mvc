---
params:
  tenetId: number
  userId: number
result: Vote
---
SELECT * FROM votes WHERE tenet_id = @tenetId AND user_id = @userId
