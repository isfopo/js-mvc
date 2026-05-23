SELECT t.*, u.login AS proposer_login, u.avatar_url AS proposer_avatar
FROM tenets t
JOIN users u ON u.id = t.proposed_by_id
WHERE t.slug = @slug
