package gateway

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type accountRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type accountResponse struct {
	OK            bool   `json:"ok"`
	UID           int64  `json:"uid,omitempty"`
	LoginToken    string `json:"login_token,omitempty"`
	TokenTimestamp int64 `json:"token_timestamp,omitempty"`
	Error         string `json:"error,omitempty"`
}

var accountUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,32}$`)

func (s *LoginServer) handleAccount(w http.ResponseWriter, r *http.Request, db *SQLiteStore) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.TLS == nil {
		http.Error(w, "HTTPS required", http.StatusUpgradeRequired)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	defer r.Body.Close()
	var req accountRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeAccountJSON(w, http.StatusBadRequest, accountResponse{Error: "invalid request"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if !accountUsernamePattern.MatchString(req.Username) || len(req.Password) < 8 || len(req.Password) > 128 {
		writeAccountJSON(w, http.StatusBadRequest, accountResponse{Error: "username: 3-32 латинских символа, цифры, _ или -; пароль: 8-128 символов"})
		return
	}
	switch r.URL.Path {
	case "/account/register":
		s.registerAccount(w, r, db, req)
	case "/account/login":
		s.loginAccount(w, r, db, req)
	default:
		http.NotFound(w, r)
	}
}

func (s *LoginServer) registerAccount(w http.ResponseWriter, r *http.Request, db *SQLiteStore, req accountRequest) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "account creation failed"})
		return
	}
	tx, err := db.DB.SQL.BeginTx(r.Context(), nil)
	if err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "account creation failed"})
		return
	}
	defer tx.Rollback()
	var uid int64
	if err = tx.QueryRowContext(r.Context(), "SELECT COALESCE(MAX(uid), 1000001) + 1 FROM profile").Scan(&uid); err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "account creation failed"})
		return
	}
	if _, err = tx.ExecContext(r.Context(),
		"INSERT INTO player_account(username,password_hash,uid,created_ts) VALUES(?,?,?,?)",
		req.Username, string(hash), uid, float64(time.Now().Unix())); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeAccountJSON(w, http.StatusConflict, accountResponse{Error: "username already exists"})
		} else {
			writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "account creation failed"})
		}
		return
	}
	now := float64(time.Now().Unix())
	if _, err = tx.ExecContext(r.Context(),
		"INSERT INTO profile(uid,name,created_ts,updated_ts) VALUES(?,?,?,?)",
		uid, req.Username, now, now); err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "profile creation failed"})
		return
	}
	if err = tx.Commit(); err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "account creation failed"})
		return
	}
	s.issueAccountToken(w, r, db, uid)
}

func (s *LoginServer) loginAccount(w http.ResponseWriter, r *http.Request, db *SQLiteStore, req accountRequest) {
	var uid int64
	var hash string
	err := db.DB.SQL.QueryRowContext(r.Context(),
		"SELECT uid,password_hash FROM player_account WHERE username=? COLLATE NOCASE",
		req.Username).Scan(&uid, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		writeAccountJSON(w, http.StatusUnauthorized, accountResponse{Error: "invalid username or password"})
		return
	}
	s.issueAccountToken(w, r, db, uid)
}

func (s *LoginServer) issueAccountToken(w http.ResponseWriter, r *http.Request, db *SQLiteStore, uid int64) {
	ttl := time.Duration(s.cfg.TokenTTL) * 24 * time.Hour
	if ttl <= 0 { ttl = 7 * 24 * time.Hour }
	token := NewLogintoken(uid)
	info := TokenInfo{Userid: uid, IssuedAt: time.Now().Unix(), Region: s.cfg.Region}
	if err := db.SaveToken(r.Context(), token, info, ttl); err != nil {
		writeAccountJSON(w, http.StatusInternalServerError, accountResponse{Error: "token issuance failed"})
		return
	}
	writeAccountJSON(w, http.StatusOK, accountResponse{
		OK: true, UID: uid, LoginToken: token, TokenTimestamp: time.Now().Add(ttl).Unix(),
	})
}

func writeAccountJSON(w http.ResponseWriter, status int, response accountResponse) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}

var _ = sql.ErrNoRows
