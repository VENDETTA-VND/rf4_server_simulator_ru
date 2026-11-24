-- Player accounts: credentials are independent of client IP addresses.
CREATE TABLE IF NOT EXISTS player_account(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    uid INTEGER NOT NULL UNIQUE,
    created_ts REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_account_uid ON player_account(uid);
