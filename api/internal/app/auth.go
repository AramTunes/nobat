package app

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"math/big"
	"strings"
	"time"
)

const codeTTL = 10 * time.Minute

func normalizePhone(raw string) (string, error) {
	var b strings.Builder
	for _, r := range latinDigits(raw) {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	phone := b.String()
	switch {
	case strings.HasPrefix(phone, "0098"):
		phone = "0" + phone[4:]
	case strings.HasPrefix(phone, "98") && len(phone) == 12:
		phone = "0" + phone[2:]
	case strings.HasPrefix(phone, "9") && len(phone) == 10:
		phone = "0" + phone
	}
	if len(phone) != 11 || !strings.HasPrefix(phone, "09") {
		return "", fail(400, "VALIDATION", "شماره موبایل معتبر نیست")
	}
	return phone, nil
}

func normalizeUsername(raw string) (string, error) {
	username := strings.TrimSpace(latinDigits(raw))
	if !userRe.MatchString(username) {
		return "", fail(400, "VALIDATION", "نام کاربری باید ۳ تا ۲۴ حرف، عدد یا _ باشد")
	}
	return username, nil
}

func phoneEmail(phone string) string { return phone + "@phone.nobatak.ir" }

type accountRow struct {
	UserID       string
	Email        string
	HasPassword  bool
	PasswordHash string
}

func (s *Service) accountByPhone(phone string) (*accountRow, error) {
	var row accountRow
	var has int
	err := s.db.QueryRow(`
		SELECT p.user_id, u.email, p.has_password, u.password_hash
		FROM profiles p JOIN users u ON u.id = p.user_id
		WHERE p.phone = ?`, phone).Scan(&row.UserID, &row.Email, &has, &row.PasswordHash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row.HasPassword = has != 0
	return &row, nil
}

func (s *Service) openSession(userID string) (string, error) {
	token := newToken()
	_, err := s.db.Exec(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)`,
		hashToken(token), userID, s.now().Add(30*24*time.Hour).UTC().Format(time.RFC3339))
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) UserID(token string) (string, error) {
	if token == "" {
		return "", fail(401, "UNAUTHORIZED", "برای ادامه وارد شوید")
	}
	var userID, exp string
	err := s.db.QueryRow(`SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`, hashToken(token)).Scan(&userID, &exp)
	if err == sql.ErrNoRows {
		return "", fail(401, "UNAUTHORIZED", "برای ادامه وارد شوید")
	}
	if err != nil {
		return "", err
	}
	until, err := time.Parse(time.RFC3339, exp)
	if err != nil || s.now().After(until) {
		return "", fail(401, "UNAUTHORIZED", "برای ادامه وارد شوید")
	}
	return userID, nil
}

type SessionUser struct {
	ID              string  `json:"id"`
	DisplayName     *string `json:"displayName"`
	PrimaryEmail    *string `json:"primaryEmail"`
	ProfileImageURL *string `json:"profileImageUrl"`
	IsDevFallback   bool    `json:"isDevFallback"`
}

func (s *Service) Session(token string) (*SessionUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if token == "" {
		return nil, nil
	}
	userID, err := s.UserID(token)
	if err != nil {
		return nil, nil
	}
	var name, email string
	if err := s.db.QueryRow(`SELECT name, email FROM users WHERE id = ?`, userID).Scan(&name, &email); err != nil {
		return nil, nil
	}
	var display string
	_ = s.db.QueryRow(`SELECT display_name FROM profiles WHERE user_id = ?`, userID).Scan(&display)
	if display == "" {
		display = name
	}
	return &SessionUser{ID: userID, DisplayName: &display, PrimaryEmail: &email}, nil
}

func (s *Service) SignOut(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if token == "" {
		return
	}
	_, _ = s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
}

func (s *Service) LookupPhone(raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	phone, err := normalizePhone(mustString(raw, "phone"))
	if err != nil {
		return nil, err
	}
	if !s.rate("lookup:"+phone, 20, time.Minute) {
		return nil, fail(429, "RATE", "چند لحظه بعد دوباره تلاش کنید")
	}
	acc, err := s.accountByPhone(phone)
	if err != nil {
		return nil, err
	}
	return map[string]any{"registered": acc != nil}, nil
}

func mustString(m map[string]any, key string) string {
	s, _ := m[key].(string)
	return s
}

func (s *Service) SendCode(raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	phone, err := normalizePhone(mustString(raw, "phone"))
	if err != nil {
		return nil, err
	}
	purpose := mustString(raw, "purpose")
	if purpose != "login" && purpose != "reset" && purpose != "signup" {
		return nil, fail(400, "VALIDATION", "درخواست نامعتبر است")
	}
	if !s.rate("code:"+phone, 5, codeTTL) {
		return nil, fail(429, "RATE", "تعداد درخواست کد زیاد است. کمی بعد دوباره بخواهید")
	}
	acc, err := s.accountByPhone(phone)
	if err != nil {
		return nil, err
	}
	if purpose == "signup" && acc != nil {
		return nil, fail(409, "CONFLICT", "این شماره قبلاً ثبت شده است. از ورود استفاده کنید")
	}
	if purpose != "signup" && acc == nil {
		return nil, fail(404, "NOT_FOUND", "این شماره ثبت نشده است. از شروع رایگان حساب بسازید")
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return nil, err
	}
	code := pad6(int(n.Int64()))
	now := s.now().UTC().Format(time.RFC3339)
	if _, err := s.db.Exec(`UPDATE phone_codes SET consumed_at = ? WHERE phone = ? AND purpose = ? AND consumed_at IS NULL`, now, phone, purpose); err != nil {
		return nil, err
	}
	exp := s.now().Add(codeTTL).UTC().Format(time.RFC3339)
	if _, err := s.db.Exec(`INSERT INTO phone_codes (id, phone, purpose, code_hash, expires_at) VALUES (?,?,?,?,?)`,
		newID(), phone, purpose, hashCode(phone, purpose, code), exp); err != nil {
		return nil, err
	}
	return map[string]any{"sent": true, "code": code}, nil
}

func pad6(n int) string {
	s := strings.Repeat("0", 6) + itoa(n)
	return s[len(s)-6:]
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

func hashesMatch(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func (s *Service) consumeCode(phone, purpose, code string) error {
	code = latinDigits(strings.TrimSpace(code))
	if len(code) != 6 {
		return fail(400, "VALIDATION", "کد تأیید ۶ رقمی را وارد کنید")
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			return fail(400, "VALIDATION", "کد تأیید ۶ رقمی را وارد کنید")
		}
	}
	var id, hash, exp string
	var attempts int
	err := s.db.QueryRow(`
		SELECT id, code_hash, attempts, expires_at FROM phone_codes
		WHERE phone = ? AND purpose = ? AND consumed_at IS NULL
		ORDER BY expires_at DESC LIMIT 1`, phone, purpose).Scan(&id, &hash, &attempts, &exp)
	if err == sql.ErrNoRows {
		return fail(400, "CODE", "کد منقضی یا نادرست است. دوباره درخواست کنید")
	}
	if err != nil {
		return err
	}
	until, _ := time.Parse(time.RFC3339, exp)
	if s.now().After(until) || attempts >= 5 {
		return fail(400, "CODE", "کد منقضی یا نادرست است. دوباره درخواست کنید")
	}
	if !hashesMatch(hash, hashCode(phone, purpose, code)) {
		_, _ = s.db.Exec(`UPDATE phone_codes SET attempts = attempts + 1 WHERE id = ?`, id)
		return fail(400, "CODE", "کد تأیید نادرست است")
	}
	_, err = s.db.Exec(`UPDATE phone_codes SET consumed_at = ? WHERE id = ?`, s.now().UTC().Format(time.RFC3339), id)
	return err
}

func (s *Service) SignInPassword(raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	phone, err := normalizePhone(mustString(raw, "phone"))
	if err != nil {
		return nil, err
	}
	password := mustString(raw, "password")
	if !s.rate("pass:"+phone, 8, time.Minute) {
		return nil, fail(429, "RATE", "تلاش زیاد بود. کمی بعد دوباره وارد شوید")
	}
	acc, err := s.accountByPhone(phone)
	if err != nil {
		return nil, err
	}
	if acc == nil {
		return nil, fail(404, "NOT_FOUND", "این شماره ثبت نشده است")
	}
	if !acc.HasPassword {
		return nil, fail(400, "AUTH", "هنوز رمزی نگذاشته‌اید. ورود بدون رمز را بزنید")
	}
	if !checkPassword(acc.PasswordHash, password) {
		return nil, fail(400, "AUTH", "رمز عبور نادرست است")
	}
	token, err := s.openSession(acc.UserID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"token": token}, nil
}

func (s *Service) SignInCode(raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	phone, err := normalizePhone(mustString(raw, "phone"))
	if err != nil {
		return nil, err
	}
	code := strings.TrimSpace(mustString(raw, "code"))
	acc, err := s.accountByPhone(phone)
	if err != nil {
		return nil, err
	}
	if acc == nil {
		return nil, fail(404, "NOT_FOUND", "این شماره ثبت نشده است")
	}
	if err := s.consumeCode(phone, "login", code); err != nil {
		return nil, err
	}
	token, err := s.openSession(acc.UserID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"token": token}, nil
}

func (s *Service) ResetPassword(raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	phone, err := normalizePhone(mustString(raw, "phone"))
	if err != nil {
		return nil, err
	}
	code := strings.TrimSpace(mustString(raw, "code"))
	password := mustString(raw, "password")
	confirm := mustString(raw, "confirm")
	if len(password) < 8 {
		return nil, fail(400, "VALIDATION", "رمز باید حداقل ۸ نویسه باشد")
	}
	if password != confirm {
		return nil, fail(400, "VALIDATION", "تکرار رمز با رمز یکی نیست")
	}
	acc, err := s.accountByPhone(phone)
	if err != nil {
		return nil, err
	}
	if acc == nil {
		return nil, fail(404, "NOT_FOUND", "این شماره ثبت نشده است")
	}
	if err := s.consumeCode(phone, "reset", code); err != nil {
		return nil, err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, acc.UserID); err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`UPDATE profiles SET has_password = 1 WHERE user_id = ?`, acc.UserID); err != nil {
		return nil, err
	}
	token, err := s.openSession(acc.UserID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"token": token}, nil
}

