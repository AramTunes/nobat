package app

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  username TEXT,
  activity_id TEXT,
  page_for TEXT,
  page_name TEXT,
  has_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_uq ON profiles (phone) WHERE phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_uq ON profiles (lower(username)) WHERE username IS NOT NULL AND username <> '';
CREATE TABLE IF NOT EXISTS phone_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS phone_codes_lookup_idx ON phone_codes (phone, purpose, expires_at);
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  status TEXT NOT NULL DEFAULT 'active',
  status_reason TEXT NOT NULL DEFAULT '',
  cancel_before_minutes INTEGER NOT NULL DEFAULT 120,
  min_lead_minutes INTEGER NOT NULL DEFAULT 60,
  max_horizon_days INTEGER NOT NULL DEFAULT 30,
  slot_step_minutes INTEGER NOT NULL DEFAULT 15,
  allow_any_staff INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS page_views (
  business_id TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS page_view_days (
  business_id TEXT NOT NULL,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day)
);
CREATE TABLE IF NOT EXISTS page_view_visitors (
  business_id TEXT NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (business_id, day, visitor)
);
CREATE TABLE IF NOT EXISTS page_clicks (
  business_id TEXT NOT NULL,
  day TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, day)
);
CREATE TABLE IF NOT EXISTS memberships (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (business_id, user_id)
);
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  branch_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  price_toman INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  PRIMARY KEY (staff_id, service_id)
);
CREATE TABLE IF NOT EXISTS working_hours (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS breaks (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  staff_id TEXT,
  date_local TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_user_uq ON customers (business_id, user_id) WHERE user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_user_id TEXT,
  created_by_user_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  buffer_until TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'online',
  idempotency_key TEXT,
  note TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_uq ON bookings (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_id TEXT,
  booking_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'recorded',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'skipped',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  business_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	if err := seed(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func seed(db *sql.DB) error {
	_, err := db.Exec(`
INSERT INTO categories (id, name, slug, sort) VALUES
  ('cat-beauty', 'زیبایی و آرایش', 'beauty', 1),
  ('cat-health', 'سلامت', 'health', 2),
  ('cat-consult', 'مشاوره', 'consult', 3),
  ('cat-edu', 'آموزش', 'education', 4),
  ('cat-sport', 'ورزش', 'sport', 5),
  ('cat-auto', 'خودرو', 'auto', 6),
  ('cat-pets', 'حیوانات خانگی', 'pets', 7),
  ('cat-other', 'سایر', 'other', 8)
ON CONFLICT (id) DO NOTHING;
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('platform_name', 'نوبتک', ''),
  ('support_email', '', '')
ON CONFLICT (key) DO NOTHING;
`)
	return err
}
