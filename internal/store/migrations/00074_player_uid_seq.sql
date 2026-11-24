-- Monotonic UID allocator. The counter is server-owned and never decreases,
-- so a deleted account's UID is not reused by a later registration.
CREATE TABLE IF NOT EXISTS player_uid_seq(
    id INTEGER PRIMARY KEY CHECK(id=1),
    next_uid INTEGER NOT NULL
);
INSERT OR IGNORE INTO player_uid_seq(id, next_uid)
SELECT 1, COALESCE(MAX(uid), 1000000) + 1 FROM profile;
UPDATE player_uid_seq
SET next_uid = CASE
    WHEN next_uid <= COALESCE((SELECT MAX(uid) FROM profile), 1000000)
    THEN COALESCE((SELECT MAX(uid) FROM profile), 1000000) + 1
    ELSE next_uid
END
WHERE id=1;
