---
result: "Tenet & { proposer_login: string, proposer_avatar: string | null }"
---
SELECT t.*, u.login AS proposer_login, u.avatar_url AS proposer_avatar
FROM tenets t
JOIN users u ON u.id = t.proposed_by_id
ORDER BY t.created_at DESC
