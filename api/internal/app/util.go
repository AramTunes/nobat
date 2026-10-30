package app

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
	"nobatak/internal/booking"
)

var (
	dayRe   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	userRe  = regexp.MustCompile(`^[\p{L}\p{N}_]{3,24}$`)
	keyRe   = regexp.MustCompile(`^[a-zA-Z0-9_:-]{8,80}$`)
	slugRe  = regexp.MustCompile(`[^\p{L}\p{N}-]+`)
	spaceRe = regexp.MustCompile(`\s+`)
	dashRe  = regexp.MustCompile(`-+`)
)

type Service struct {
	db   *sql.DB
	mu   sync.Mutex
	hits map[string][]time.Time
	now  func() time.Time
}

func New(db *sql.DB) *Service {
	return &Service{db: db, hits: map[string][]time.Time{}, now: time.Now}
}

func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b[:])
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func shortID() string {
	return strings.ReplaceAll(newID(), "-", "")[:8]
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newToken() string {
	var b [32]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func hashCode(phone, purpose, code string) string {
	sum := sha256.Sum256([]byte(purpose + ":" + phone + ":" + code))
	return hex.EncodeToString(sum[:])
}

func clip(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

func latinDigits(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r >= '۰' && r <= '۹':
			b.WriteByte(byte('0' + (r - '۰')))
		case r >= '٠' && r <= '٩':
			b.WriteByte(byte('0' + (r - '٠')))
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

func textOf(m map[string]any, key string, max int, fallback string) (string, error) {
	v, ok := m[key]
	if !ok || v == nil {
		return fallback, nil
	}
	s, ok := v.(string)
	if !ok {
		return "", fail(400, "VALIDATION", "درخواست نامعتبر است")
	}
	return clip(strings.TrimSpace(latinDigits(s)), max), nil
}

func intOf(m map[string]any, key string, minN, maxN int) (int, error) {
	v, ok := m[key]
	if !ok || v == nil {
		return 0, fail(400, "VALIDATION", "مقدار عددی نامعتبر است")
	}
	n, ok := asInt(v)
	if !ok || n < minN || n > maxN {
		return 0, fail(400, "VALIDATION", "مقدار عددی نامعتبر است")
	}
	return n, nil
}

func asInt(v any) (int, bool) {
	switch t := v.(type) {
	case float64:
		if t != math.Trunc(t) {
			return 0, false
		}
		return int(t), true
	case int:
		return t, true
	case int64:
		return int(t), true
	case json.Number:
		i, err := t.Int64()
		if err != nil {
			return 0, false
		}
		return int(i), true
	case string:
		i, err := strconv.Atoi(strings.TrimSpace(latinDigits(t)))
		if err != nil {
			return 0, false
		}
		return i, true
	default:
		return 0, false
	}
}

func notFalse(m map[string]any, key string) bool {
	v, ok := m[key]
	if !ok || v == nil {
		return true
	}
	b, ok := v.(bool)
	if !ok {
		return true
	}
	return b
}

func isTrue(m map[string]any, key string) bool {
	b, ok := m[key].(bool)
	return ok && b
}

func dayOf(v any) (string, error) {
	s, ok := v.(string)
	if !ok || !dayRe.MatchString(s) {
		return "", fail(400, "VALIDATION", "تاریخ نامعتبر است")
	}
	return s, nil
}

func parseISO(v any) (time.Time, error) {
	s, ok := v.(string)
	if !ok {
		return time.Time{}, fail(400, "VALIDATION", "زمان نامعتبر است")
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UTC(), nil
	}
	return time.Time{}, fail(400, "VALIDATION", "زمان نامعتبر است")
}

func like(q string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(q) + "%"
}

func (s *Service) rate(key string, limit int, window time.Duration) bool {
	now := s.now()
	prev := s.hits[key]
	recent := make([]time.Time, 0, len(prev)+1)
	for _, t := range prev {
		if now.Sub(t) < window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= limit {
		s.hits[key] = recent
		return false
	}
	s.hits[key] = append(recent, now)
	return true
}

func slugify(name string) string {
	base := strings.TrimSpace(name)
	base = spaceRe.ReplaceAllString(base, "-")
	base = slugRe.ReplaceAllString(base, "")
	base = dashRe.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	base = clip(base, 40)
	if base == "" {
		base = "biz"
	}
	return base + "-" + shortID()
}

func assertZone(name string) error {
	if _, err := booking.LoadZone(name); err != nil {
		return fail(400, "VALIDATION", "منطقه زمانی نامعتبر است")
	}
	return nil
}

func hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func mustZone(name string) *time.Location {
	loc, err := booking.LoadZone(name)
	if err != nil {
		loc, _ = booking.LoadZone("Asia/Tehran")
	}
	return loc
}

func bint(v bool) int {
	if v {
		return 1
	}
	return 0
}
