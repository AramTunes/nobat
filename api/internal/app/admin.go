package app

import (
	"database/sql"
	"strings"
	"time"
)

func (s *Service) AdminOverview(userID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	return s.overview()
}

func (s *Service) overview() (map[string]any, error) {
	var users int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&users)
	biz := map[string]int{}
	rows, err := s.db.Query(`SELECT status, COUNT(*) FROM businesses GROUP BY status`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var k string
		var n int
		_ = rows.Scan(&k, &n)
		biz[k] = n
	}
	rows.Close()
	books := map[string]int{}
	brows, err := s.db.Query(`SELECT status, COUNT(*) FROM bookings GROUP BY status`)
	if err != nil {
		return nil, err
	}
	for brows.Next() {
		var k string
		var n int
		_ = brows.Scan(&k, &n)
		books[k] = n
	}
	brows.Close()
	settings := []map[string]any{}
	srows, err := s.db.Query(`SELECT key, value FROM platform_settings ORDER BY key`)
	if err != nil {
		return nil, err
	}
	for srows.Next() {
		var k, v string
		_ = srows.Scan(&k, &v)
		settings = append(settings, map[string]any{"key": k, "value": v})
	}
	srows.Close()
	return map[string]any{
		"users": users, "businesses": biz, "bookings": books, "settings": settings,
		"note": "ارسال پیامک و ایمیل وصل نیست. ردیف‌های کار با وضعیت skipped ارسال واقعی نیستند.",
	}, nil
}

func (s *Service) AdminUsers(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	q, _ := textOf(raw, "q", 80, "")
	rows, err := s.db.Query(`
		SELECT u.id, u.name, u.email, u.created_at, EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id = u.id)
		FROM users u
		WHERE (? = '' OR u.name LIKE ? ESCAPE '\' OR u.email LIKE ? ESCAPE '\')
		ORDER BY u.created_at DESC LIMIT 50`, q, like(q), like(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, email, created string
		var admin int
		if err := rows.Scan(&id, &name, &email, &created, &admin); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "email": email, "createdAt": created, "isAdmin": admin != 0})
	}
	return out, rows.Err()
}

func (s *Service) AdminBusinesses(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	q, _ := textOf(raw, "q", 80, "")
	rows, err := s.db.Query(`
		SELECT id, name, slug, status, status_reason, city, is_demo FROM businesses
		WHERE (? = '' OR name LIKE ? ESCAPE '\' OR city LIKE ? ESCAPE '\')
		ORDER BY created_at DESC LIMIT 80`, q, like(q), like(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, slug, status, reason, city string
		var demo int
		if err := rows.Scan(&id, &name, &slug, &status, &reason, &city, &demo); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "slug": slug, "status": status, "status_reason": reason, "city": city, "is_demo": demo != 0})
	}
	return out, rows.Err()
}

func (s *Service) Moderate(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	businessID, _ := textOf(raw, "businessId", 80, "")
	status, _ := textOf(raw, "status", 20, "")
	reason, _ := textOf(raw, "reason", 300, "")
	if status != "active" && status != "inactive" && status != "suspended" {
		return nil, fail(400, "VALIDATION", "وضعیت نامعتبر است")
	}
	if status != "active" && len([]rune(reason)) < 3 {
		return nil, fail(400, "VALIDATION", "دلیل غیرفعال‌سازی یا تعلیق را بنویسید")
	}
	if status == "active" {
		reason = ""
	}
	res, err := s.db.Exec(`UPDATE businesses SET status = ?, status_reason = ? WHERE id = ?`, status, reason, businessID)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fail(404, "NOT_FOUND", "کسب‌وکار پیدا نشد")
	}
	_ = s.audit(s.db, userID, "moderate_business", "business", strPtr(businessID), strPtr(businessID), status+": "+reason)
	return map[string]any{"businessId": businessID, "status": status}, nil
}

func (s *Service) AdminCategories(userID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`SELECT id, name, slug, active, sort FROM categories ORDER BY sort, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, slug string
		var active, sort int
		if err := rows.Scan(&id, &name, &slug, &active, &sort); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "name": name, "slug": slug, "active": active != 0, "sort": sort})
	}
	return out, rows.Err()
}

func (s *Service) SaveCategory(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	name, err := textOf(raw, "name", 60, "")
	if err != nil || len([]rune(name)) < 2 {
		if err != nil {
			return nil, err
		}
		return nil, fail(400, "VALIDATION", "نام دسته را وارد کنید")
	}
	slug, _ := textOf(raw, "slug", 40, "")
	slug = strings.ToLower(slug)
	clean := strings.Builder{}
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			clean.WriteRune(r)
		}
	}
	slug = clean.String()
	if slug == "" {
		slug = "cat-" + shortID()
	}
	categoryID, _ := textOf(raw, "id", 40, "")
	if categoryID == "" {
		categoryID = newID()
	}
	active := bint(notFalse(raw, "active"))
	var existing string
	err = s.db.QueryRow(`SELECT id FROM categories WHERE id = ?`, categoryID).Scan(&existing)
	if err == nil {
		_, err = s.db.Exec(`UPDATE categories SET name=?, slug=?, active=? WHERE id=?`, name, slug, active, categoryID)
	} else if err == sql.ErrNoRows {
		_, err = s.db.Exec(`INSERT INTO categories (id, name, slug, sort, active) VALUES (?,?,?,50,?)`, categoryID, name, slug, active)
	}
	if err != nil {
		return nil, err
	}
	_ = s.audit(s.db, userID, "save_category", "category", strPtr(categoryID), nil, name)
	return map[string]any{"categoryId": categoryID}, nil
}

func (s *Service) AdminAudit(userID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`SELECT id, actor_user_id, action, entity, entity_id, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 80`)
	if err != nil {
		return nil, err
	}
	logs := []map[string]any{}
	for rows.Next() {
		var id, actor, action, entity, detail, created string
		var entityID sql.NullString
		if err := rows.Scan(&id, &actor, &action, &entity, &entityID, &detail, &created); err != nil {
			rows.Close()
			return nil, err
		}
		var eid any
		if entityID.Valid {
			eid = entityID.String
		}
		logs = append(logs, map[string]any{"id": id, "actorUserId": actor, "action": action, "entity": entity, "entityId": eid, "detail": detail, "createdAt": created})
	}
	rows.Close()
	jrows, err := s.db.Query(`SELECT channel, status, COUNT(*) FROM notification_jobs GROUP BY channel, status`)
	if err != nil {
		return nil, err
	}
	jobs := []map[string]any{}
	for jrows.Next() {
		var channel, status string
		var n int
		_ = jrows.Scan(&channel, &status, &n)
		jobs = append(jobs, map[string]any{"channel": channel, "status": status, "n": n})
	}
	jrows.Close()
	return map[string]any{
		"logs": logs, "jobs": jobs,
		"errorLog": "گزارش خطای متمرکز به سرویس خارجی وصل نیست. رخدادهای مهم همین‌جا در حسابرسی است.",
	}, nil
}

func (s *Service) SaveSettings(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.requireAdmin(userID); err != nil {
		return nil, err
	}
	now := s.now().UTC().Format(time.RFC3339)
	for _, key := range []string{"platform_name", "support_email"} {
		if _, ok := raw[key].(string); !ok {
			continue
		}
		value, _ := textOf(raw, key, 120, "")
		if _, err := s.db.Exec(`INSERT INTO platform_settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, key, value, now); err != nil {
			return nil, err
		}
	}
	_ = s.audit(s.db, userID, "save_settings", "platform_settings", nil, nil, "")
	return s.overview()
}
