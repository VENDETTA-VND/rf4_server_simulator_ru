package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var adminAccountUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,32}$`)

func (s *Server) handleAccounts(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	rows, err := s.db.SQL.QueryContext(r.Context(), `SELECT id, username, uid, created_ts FROM player_account WHERE username LIKE ? COLLATE NOCASE OR CAST(uid AS TEXT) LIKE ? ORDER BY id DESC`, "%"+q+"%", "%"+q+"%")
	if err != nil { httpError(w, 500, "не удалось получить аккаунты"); return }
	defer rows.Close()
	out := make([]map[string]any, 0)
	for rows.Next() {
		var id, uid int64; var username string; var created float64
		if err := rows.Scan(&id, &username, &uid, &created); err != nil { httpError(w, 500, "не удалось прочитать аккаунты"); return }
		out = append(out, map[string]any{"id": id, "username": username, "uid": uid, "created_ts": created})
	}
	if err := rows.Err(); err != nil { httpError(w, 500, "ошибка чтения аккаунтов"); return }
	writeJSON(w, out)
}

func (s *Server) handleAccountUpdate(w http.ResponseWriter, r *http.Request) {
	var req struct { UID int64 `json:"uid"`; Username string `json:"username"`; Password string `json:"password"` }
	if err := readJSON(r, &req); err != nil || req.UID <= 0 { httpError(w, 400, "параметры аккаунта указаны неверно"); return }
	req.Username = strings.TrimSpace(req.Username)
	if !adminAccountUsernamePattern.MatchString(req.Username) { httpError(w, 400, "логин: 3-32 латинских символа, цифры, _ или -"); return }
	if req.Password != "" && (len(req.Password) < 8 || len(req.Password) > 128) { httpError(w, 400, "новый пароль должен содержать 8-128 символов"); return }
	ctx := r.Context()
	var exists int
	if err := s.db.SQL.QueryRowContext(ctx, "SELECT COUNT(*) FROM player_account WHERE uid=?", req.UID).Scan(&exists); err != nil { httpError(w, 500, "не удалось проверить аккаунт"); return }
	if exists == 0 { httpError(w, 404, "аккаунт не найден"); return }
	var oldUsername string
	if err := s.db.SQL.QueryRowContext(ctx, "SELECT username FROM player_account WHERE uid=?", req.UID).Scan(&oldUsername); err != nil { httpError(w, 500, "не удалось прочитать аккаунт"); return }
	if req.Password == "" {
		_, err := s.db.SQL.ExecContext(ctx, "UPDATE player_account SET username=? WHERE uid=?", req.Username, req.UID)
		if err != nil { if strings.Contains(strings.ToLower(err.Error()), "unique") { httpError(w, 409, "такой логин уже занят"); return }; httpError(w, 500, "не удалось изменить логин"); return }
	} else {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil { httpError(w, 500, "не удалось хешировать пароль"); return }
		_, err = s.db.SQL.ExecContext(ctx, "UPDATE player_account SET username=?, password_hash=? WHERE uid=?", req.Username, string(hash), req.UID)
		if err != nil { if strings.Contains(strings.ToLower(err.Error()), "unique") { httpError(w, 409, "такой логин уже занят"); return }; httpError(w, 500, "не удалось изменить аккаунт"); return }
	}
	_ = s.db.AuditLogWrite(ctx, adminOf(r), "account_update", fmt.Sprintf("uid=%d", req.UID), fmt.Sprintf("username:%s->%s password_changed:%t", oldUsername, req.Username, req.Password != ""))
	writeJSON(w, map[string]any{"ok": true, "uid": req.UID, "username": req.Username, "password_changed": req.Password != "", "updated_ts": time.Now().Unix()})
}
