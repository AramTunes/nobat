package app

import (
	"database/sql"
	"time"

	"nobatak/internal/booking"
)

func (s *Service) UpdateBusiness(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	name, err := textOf(raw, "name", 80, "")
	if err != nil || len([]rune(name)) < 2 {
		if err != nil {
			return nil, err
		}
		return nil, fail(400, "VALIDATION", "نام کسب‌وکار را وارد کنید")
	}
	timezone, err := textOf(raw, "timezone", 64, "Asia/Tehran")
	if err != nil {
		return nil, err
	}
	if err := assertZone(timezone); err != nil {
		return nil, err
	}
	categoryID, _ := textOf(raw, "categoryId", 40, "")
	desc, _ := textOf(raw, "description", 2000, "")
	city, _ := textOf(raw, "city", 60, "")
	address, _ := textOf(raw, "address", 200, "")
	phone, _ := textOf(raw, "phone", 20, "")
	cancel, err := intOf(raw, "cancelBeforeMinutes", 0, 7*24*60)
	if err != nil {
		return nil, err
	}
	lead, err := intOf(raw, "minLeadMinutes", 0, 7*24*60)
	if err != nil {
		return nil, err
	}
	horizon, err := intOf(raw, "maxHorizonDays", 1, 180)
	if err != nil {
		return nil, err
	}
	step, err := intOf(raw, "slotStepMinutes", 5, 60)
	if err != nil {
		return nil, err
	}
	var cat any
	if categoryID != "" {
		cat = categoryID
	}
	_, err = s.db.Exec(`UPDATE businesses SET name=?, description=?, category_id=?, city=?, address=?, phone=?, timezone=?, cancel_before_minutes=?, min_lead_minutes=?, max_horizon_days=?, slot_step_minutes=?, allow_any_staff=? WHERE id=?`,
		name, desc, cat, city, address, phone, timezone, cancel, lead, horizon, step, bint(isTrue(raw, "allowAnyStaff")), businessID)
	if err != nil {
		return nil, err
	}
	_ = s.audit(s.db, userID, "update_business", "business", strPtr(businessID), strPtr(businessID), name)
	return map[string]any{"businessId": businessID}, nil
}

func (s *Service) DeleteBusiness(userID, businessID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.requireRole(s.db, userID, businessID, "owner"); err != nil {
		return nil, err
	}
	_ = s.audit(s.db, userID, "delete_business", "business", strPtr(businessID), strPtr(businessID), "")
	_, err := s.db.Exec(`DELETE FROM businesses WHERE id = ? AND owner_user_id = ?`, businessID, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) ManageBusiness(userID, businessID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager", "staff"); err != nil {
		return nil, err
	}
	b, err := loadBiz(s.db, "id = ?", businessID)
	if err != nil {
		return nil, err
	}
	return s.snapshot(s.db, b, true)
}

func (s *Service) SaveService(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	name, err := textOf(raw, "name", 80, "")
	if err != nil || len([]rune(name)) < 2 {
		if err != nil {
			return nil, err
		}
		return nil, fail(400, "VALIDATION", "نام خدمت را وارد کنید")
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	var branch sql.NullString
	_ = s.db.QueryRow(`SELECT id FROM branches WHERE business_id = ? AND active = 1 ORDER BY name LIMIT 1`, businessID).Scan(&branch)
	serviceID, _ := textOf(raw, "id", 80, "")
	if serviceID == "" {
		serviceID = newID()
	}
	duration, err := intOf(raw, "durationMinutes", 5, 480)
	if err != nil {
		return nil, err
	}
	buffer, err := intOf(raw, "bufferMinutes", 0, 180)
	if err != nil {
		return nil, err
	}
	price, err := intOf(raw, "priceToman", 0, 100_000_000)
	if err != nil {
		return nil, err
	}
	desc, _ := textOf(raw, "description", 1000, "")
	active := bint(notFalse(raw, "active"))
	var existing string
	err = s.db.QueryRow(`SELECT id FROM services WHERE id = ? AND business_id = ?`, serviceID, businessID).Scan(&existing)
	if err == nil {
		_, err = s.db.Exec(`UPDATE services SET name=?, description=?, duration_minutes=?, buffer_minutes=?, price_toman=?, active=? WHERE id=? AND business_id=?`,
			name, desc, duration, buffer, price, active, serviceID, businessID)
	} else if err == sql.ErrNoRows {
		_, err = s.db.Exec(`INSERT INTO services (id, business_id, branch_id, name, description, duration_minutes, buffer_minutes, price_toman, active) VALUES (?,?,?,?,?,?,?,?,?)`,
			serviceID, businessID, branch, name, desc, duration, buffer, price, active)
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"serviceId": serviceID}, nil
}

func (s *Service) SaveStaff(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	name, err := textOf(raw, "name", 80, "")
	if err != nil || len([]rune(name)) < 2 {
		if err != nil {
			return nil, err
		}
		return nil, fail(400, "VALIDATION", "نام همکار را وارد کنید")
	}
	rawIDs, _ := raw["serviceIds"].([]any)
	var serviceIDs []string
	for _, item := range rawIDs {
		if s, ok := item.(string); ok && len(serviceIDs) < 30 {
			serviceIDs = append(serviceIDs, s)
		}
	}
	if len(serviceIDs) == 0 {
		return nil, fail(400, "VALIDATION", "حداقل یک خدمت را به همکار وصل کنید")
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	var branch string
	if err := s.db.QueryRow(`SELECT id FROM branches WHERE business_id = ? ORDER BY name LIMIT 1`, businessID).Scan(&branch); err != nil {
		return nil, fail(400, "VALIDATION", "شعبه پیدا نشد")
	}
	allowed := map[string]bool{}
	rows, err := s.db.Query(`SELECT id FROM services WHERE business_id = ?`, businessID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		_ = rows.Scan(&id)
		allowed[id] = true
	}
	rows.Close()
	for _, id := range serviceIDs {
		if !allowed[id] {
			return nil, fail(400, "VALIDATION", "خدمت نامعتبر است")
		}
	}
	staffID, _ := textOf(raw, "id", 80, "")
	if staffID == "" {
		staffID = newID()
	}
	title, _ := textOf(raw, "title", 80, "")
	active := bint(notFalse(raw, "active"))
	var existing string
	err = s.db.QueryRow(`SELECT id FROM staff WHERE id = ? AND business_id = ?`, staffID, businessID).Scan(&existing)
	if err == nil {
		_, err = s.db.Exec(`UPDATE staff SET name=?, title=?, active=? WHERE id=? AND business_id=?`, name, title, active, staffID, businessID)
	} else if err == sql.ErrNoRows {
		_, err = s.db.Exec(`INSERT INTO staff (id, business_id, branch_id, name, title, active) VALUES (?,?,?,?,?,?)`, staffID, businessID, branch, name, title, active)
		if err == nil {
			for _, weekday := range []int{6, 0, 1, 2, 3, 4} {
				if _, err = s.db.Exec(`INSERT INTO working_hours (id, staff_id, weekday, start_min, end_min) VALUES (?,?,?,540,1080)`, newID(), staffID, weekday); err != nil {
					return nil, err
				}
			}
		}
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`DELETE FROM staff_services WHERE staff_id = ?`, staffID); err != nil {
		return nil, err
	}
	for _, sid := range serviceIDs {
		if _, err := s.db.Exec(`INSERT INTO staff_services (staff_id, service_id) VALUES (?,?)`, staffID, sid); err != nil {
			return nil, err
		}
	}
	return map[string]any{"staffId": staffID}, nil
}

func (s *Service) SaveSchedule(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	staffID, err := textOf(raw, "staffId", 80, "")
	if err != nil {
		return nil, err
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	var exists string
	if err := s.db.QueryRow(`SELECT id FROM staff WHERE id = ? AND business_id = ?`, staffID, businessID).Scan(&exists); err != nil {
		return nil, fail(404, "NOT_FOUND", "همکار پیدا نشد")
	}
	if _, err := s.db.Exec(`DELETE FROM working_hours WHERE staff_id = ?`, staffID); err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`DELETE FROM breaks WHERE staff_id = ?`, staffID); err != nil {
		return nil, err
	}
	days, _ := raw["days"].([]any)
	if len(days) > 7 {
		days = days[:7]
	}
	for _, rawDay := range days {
		day, ok := rawDay.(map[string]any)
		if !ok {
			return nil, fail(400, "VALIDATION", "درخواست نامعتبر است")
		}
		if day["enabled"] == false {
			continue
		}
		weekday, err := intOf(day, "weekday", 0, 6)
		if err != nil {
			return nil, err
		}
		startMin, err := intOf(day, "startMin", 0, 1439)
		if err != nil {
			return nil, err
		}
		endMin, err := intOf(day, "endMin", 1, 1440)
		if err != nil {
			return nil, err
		}
		if endMin <= startMin {
			return nil, fail(400, "VALIDATION", "ساعت پایان باید بعد از شروع باشد")
		}
		if _, err := s.db.Exec(`INSERT INTO working_hours (id, staff_id, weekday, start_min, end_min) VALUES (?,?,?,?,?)`, newID(), staffID, weekday, startMin, endMin); err != nil {
			return nil, err
		}
		if day["breakStart"] == nil || day["breakEnd"] == nil || day["breakStart"] == "" || day["breakEnd"] == "" {
			continue
		}
		bs, err := intOf(day, "breakStart", 0, 1439)
		if err != nil {
			return nil, err
		}
		be, err := intOf(day, "breakEnd", 1, 1440)
		if err != nil {
			return nil, err
		}
		if be <= bs || bs < startMin || be > endMin {
			return nil, fail(400, "VALIDATION", "بازه استراحت باید داخل ساعت کاری باشد")
		}
		if _, err := s.db.Exec(`INSERT INTO breaks (id, staff_id, weekday, start_min, end_min) VALUES (?,?,?,?,?)`, newID(), staffID, weekday, bs, be); err != nil {
			return nil, err
		}
	}
	return map[string]any{"staffId": staffID}, nil
}

func (s *Service) AddHoliday(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	date, err := dayOf(raw["date"])
	if err != nil {
		return nil, err
	}
	staffID, _ := textOf(raw, "staffId", 80, "")
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	var staff any
	if staffID != "" {
		var id string
		if err := s.db.QueryRow(`SELECT id FROM staff WHERE id = ? AND business_id = ?`, staffID, businessID).Scan(&id); err != nil {
			return nil, fail(404, "NOT_FOUND", "همکار پیدا نشد")
		}
		staff = staffID
	}
	note, _ := textOf(raw, "note", 120, "")
	holidayID := newID()
	if _, err := s.db.Exec(`INSERT INTO holidays (id, business_id, staff_id, date_local, note) VALUES (?,?,?,?,?)`, holidayID, businessID, staff, date, note); err != nil {
		return nil, err
	}
	return map[string]any{"holidayId": holidayID}, nil
}

func (s *Service) RemoveHoliday(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, err := textOf(raw, "businessId", 80, "")
	if err != nil {
		return nil, err
	}
	holidayID, err := textOf(raw, "holidayId", 80, "")
	if err != nil {
		return nil, err
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager"); err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`DELETE FROM holidays WHERE id = ? AND business_id = ?`, holidayID, businessID); err != nil {
		return nil, err
	}
	return map[string]any{"removed": true}, nil
}

func (s *Service) ListCustomers(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, _ := textOf(raw, "businessId", 80, "")
	q, _ := textOf(raw, "q", 80, "")
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager", "staff"); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`
		SELECT c.id, c.name, c.phone, c.notes, COUNT(b.id), MAX(b.starts_at)
		FROM customers c
		LEFT JOIN bookings b ON b.customer_id = c.id AND b.status <> 'cancelled'
		WHERE c.business_id = ?
		  AND (? = '' OR c.name LIKE ? ESCAPE '\' OR c.phone LIKE ? ESCAPE '\')
		GROUP BY c.id ORDER BY c.created_at DESC LIMIT 80`, businessID, q, like(q), like(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, phone, notes string
		var visits int
		var last sql.NullString
		if err := rows.Scan(&id, &name, &phone, &notes, &visits, &last); err != nil {
			return nil, err
		}
		var lastVal any
		if last.Valid {
			lastVal = last.String
		}
		out = append(out, map[string]any{"id": id, "name": name, "phone": phone, "notes": notes, "visits": visits, "lastVisit": lastVal})
	}
	return out, rows.Err()
}

func (s *Service) SaveCustomer(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, _ := textOf(raw, "businessId", 80, "")
	name, err := textOf(raw, "name", 80, "")
	if err != nil || len([]rune(name)) < 2 {
		if err != nil {
			return nil, err
		}
		return nil, fail(400, "VALIDATION", "نام مشتری را وارد کنید")
	}
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager", "staff"); err != nil {
		return nil, err
	}
	phone, _ := textOf(raw, "phone", 20, "")
	notes, _ := textOf(raw, "notes", 500, "")
	customerID, _ := textOf(raw, "id", 80, "")
	if customerID == "" {
		customerID = newID()
	}
	var existing string
	err = s.db.QueryRow(`SELECT id FROM customers WHERE id = ? AND business_id = ?`, customerID, businessID).Scan(&existing)
	if err == nil {
		_, err = s.db.Exec(`UPDATE customers SET name=?, phone=?, notes=? WHERE id=?`, name, phone, notes, customerID)
	} else if err == sql.ErrNoRows {
		_, err = s.db.Exec(`INSERT INTO customers (id, business_id, name, phone, notes, created_at) VALUES (?,?,?,?,?,?)`,
			customerID, businessID, name, phone, notes, s.now().UTC().Format(time.RFC3339))
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"customerId": customerID}, nil
}

func (s *Service) Dashboard(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	businessID, _ := textOf(raw, "businessId", 80, "")
	if _, err := s.requireRole(s.db, userID, businessID, "owner", "manager", "staff"); err != nil {
		return nil, err
	}
	b, err := loadBiz(s.db, "id = ?", businessID)
	if err != nil {
		return nil, err
	}
	loc := mustZone(b.Timezone)
	from, _ := textOf(raw, "from", 10, "")
	if from == "" {
		from = booking.TodayYMD(loc, s.now())
	}
	from, err = dayOf(from)
	if err != nil {
		return nil, err
	}
	to, _ := textOf(raw, "to", 10, "")
	if to == "" {
		to = booking.AddDaysYMD(from, 6, loc)
	}
	to, err = dayOf(to)
	if err != nil {
		return nil, err
	}
	start := booking.ISO(booking.AtLocalMinute(from, 0, loc))
	end := booking.ISO(booking.AtLocalMinute(to, 1440, loc))
	crows, err := s.db.Query(`SELECT status, COUNT(*) FROM bookings WHERE business_id = ? AND starts_at >= ? AND starts_at < ? GROUP BY status`, businessID, start, end)
	if err != nil {
		return nil, err
	}
	byStatus := map[string]int{}
	for crows.Next() {
		var status string
		var n int
		_ = crows.Scan(&status, &n)
		byStatus[status] = n
	}
	crows.Close()
	var staffIDs []string
	srows, _ := s.db.Query(`SELECT id FROM staff WHERE business_id = ? AND active = 1`, businessID)
	for srows.Next() {
		var id string
		_ = srows.Scan(&id)
		staffIDs = append(staffIDs, id)
	}
	srows.Close()
	type win struct{ staff, kind string; weekday, start, end int }
	var hours, breaks []win
	hrows, _ := s.db.Query(`SELECT staff_id, weekday, start_min, end_min FROM working_hours WHERE staff_id IN (SELECT id FROM staff WHERE business_id = ? AND active = 1)`, businessID)
	for hrows.Next() {
		var w win
		_ = hrows.Scan(&w.staff, &w.weekday, &w.start, &w.end)
		hours = append(hours, w)
	}
	hrows.Close()
	brows, _ := s.db.Query(`SELECT staff_id, weekday, start_min, end_min FROM breaks WHERE staff_id IN (SELECT id FROM staff WHERE business_id = ?)`, businessID)
	for brows.Next() {
		var w win
		_ = brows.Scan(&w.staff, &w.weekday, &w.start, &w.end)
		breaks = append(breaks, w)
	}
	brows.Close()
	type hol struct{ staff sql.NullString; date string }
	var holidays []hol
	orows, _ := s.db.Query(`SELECT staff_id, date_local FROM holidays WHERE business_id = ? AND date_local >= ? AND date_local <= ?`, businessID, from, to)
	for orows.Next() {
		var h hol
		_ = orows.Scan(&h.staff, &h.date)
		holidays = append(holidays, h)
	}
	orows.Close()
	var busy []booking.BusyInterval
	urows, _ := s.db.Query(`SELECT starts_at, buffer_until FROM bookings WHERE business_id = ? AND status IN ('pending','confirmed','completed') AND buffer_until > ? AND starts_at < ?`, businessID, start, end)
	for urows.Next() {
		var a, z string
		_ = urows.Scan(&a, &z)
		as, _ := time.Parse(time.RFC3339Nano, a)
		zs, _ := time.Parse(time.RFC3339Nano, z)
		busy = append(busy, booking.BusyInterval{StartsAt: as, BufferUntil: zs})
	}
	urows.Close()
	available, occupied := 0, 0
	for day := from; day <= to; day = booking.AddDaysYMD(day, 1, loc) {
		weekday := booking.WeekdayOfYMD(day, loc)
		closed := false
		off := map[string]bool{}
		for _, h := range holidays {
			if len(h.date) >= 10 && h.date[:10] == day {
				if !h.staff.Valid || h.staff.String == "" {
					closed = true
				} else {
					off[h.staff.String] = true
				}
			}
		}
		for _, member := range staffIDs {
			if closed || off[member] {
				continue
			}
			minutes := 0
			var windows []win
			for _, w := range hours {
				if w.staff == member && w.weekday == weekday {
					minutes += w.end - w.start
					windows = append(windows, w)
				}
			}
			for _, rest := range breaks {
				if rest.staff != member || rest.weekday != weekday {
					continue
				}
				for _, w := range windows {
					a, z := rest.start, rest.end
					if w.start > a {
						a = w.start
					}
					if w.end < z {
						z = w.end
					}
					if z > a {
						minutes -= z - a
					}
				}
			}
			if minutes > 0 {
				available += minutes
			}
		}
		occupied += booking.OccupiedMinutesOnDay(busy, day, loc)
		if day == to {
			break
		}
	}
	today := booking.TodayYMD(loc, s.now())
	todayStart := booking.ISO(booking.AtLocalMinute(today, 0, loc))
	todayEnd := booking.ISO(booking.AtLocalMinute(today, 1440, loc))
	var todayN int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE business_id = ? AND status IN ('confirmed','pending') AND starts_at >= ? AND starts_at < ?`, businessID, todayStart, todayEnd).Scan(&todayN)
	free := available - occupied
	if free < 0 {
		free = 0
	}
	booked, cancelled, completed, revenue := 0, 0, 0, 0
	viewsSeries := make([]int, 30)
	visitorSeries := make([]int, 30)
	salesSeries := make([]int, 30)
	revenueSeries := make([]int, 30)
	days := make([]string, 30)
	dayIndex := map[string]int{}
	for i := 0; i < 30; i++ {
		days[i] = booking.AddDaysYMD(today, i-29, loc)
		dayIndex[days[i]] = i
	}
	vrows, verr := s.db.Query(`SELECT day, views, visitors FROM page_view_days WHERE business_id = ? AND day >= ? AND day <= ?`, businessID, days[0], days[29])
	viewTotal, visitorTotal, clickTotal := 0, 0, 0
	prevViews, prevVisitors, prevClicks := 0, 0, 0
	prevBooked, prevCancelled, prevCompleted, prevRevenue := 0, 0, 0, 0
	prevStart := booking.AddDaysYMD(days[0], -30, loc)
	if verr == nil {
		for vrows.Next() {
			var day string
			var views, visitors int
			_ = vrows.Scan(&day, &views, &visitors)
			if i, ok := dayIndex[day]; ok {
				viewsSeries[i] = views
				visitorSeries[i] = visitors
				viewTotal += views
				visitorTotal += visitors
			}
		}
		vrows.Close()
	}
	prows, perr := s.db.Query(`SELECT day, views, visitors FROM page_view_days WHERE business_id = ? AND day >= ? AND day < ?`, businessID, prevStart, days[0])
	if perr == nil {
		for prows.Next() {
			var day string
			var views, visitors int
			_ = prows.Scan(&day, &views, &visitors)
			prevViews += views
			prevVisitors += visitors
		}
		prows.Close()
	}
	crows2, cerr := s.db.Query(`SELECT day, clicks FROM page_clicks WHERE business_id = ? AND day >= ? AND day <= ?`, businessID, prevStart, days[29])
	if cerr == nil {
		for crows2.Next() {
			var day string
			var n int
			_ = crows2.Scan(&day, &n)
			if _, ok := dayIndex[day]; ok {
				clickTotal += n
			} else if day >= prevStart && day < days[0] {
				prevClicks += n
			}
		}
		crows2.Close()
	}
	fromInstant := booking.ISO(booking.AtLocalMinute(prevStart, 0, loc))
	brows, berr := s.db.Query(`SELECT b.status, b.starts_at, COALESCE(sv.price_toman, 0)
		FROM bookings b LEFT JOIN services sv ON sv.id = b.service_id
		WHERE b.business_id = ? AND b.starts_at >= ?`, businessID, fromInstant)
	if berr == nil {
		for brows.Next() {
			var status, at string
			var price int
			if err := brows.Scan(&status, &at, &price); err != nil {
				continue
			}
			when, err := time.Parse(time.RFC3339Nano, at)
			if err != nil {
				when, err = time.Parse(time.RFC3339, at)
			}
			day := ""
			if err == nil {
				day = booking.TodayYMD(loc, when)
			}
			i, ok := dayIndex[day]
			switch status {
			case "cancelled":
				if ok {
					cancelled++
				} else if day >= prevStart && day < days[0] {
					prevCancelled++
				}
			case "completed":
				if ok {
					completed++
					revenue += price
					salesSeries[i]++
					revenueSeries[i] += price
				} else if day >= prevStart && day < days[0] {
					prevCompleted++
					prevRevenue += price
				}
			case "pending", "confirmed":
				if ok {
					booked++
				} else if day >= prevStart && day < days[0] {
					prevBooked++
				}
			}
		}
		brows.Close()
	}
	booked += completed
	prevBooked += prevCompleted
	return map[string]any{
		"from": from, "to": to, "timezone": b.Timezone, "today": todayN, "byStatus": byStatus,
		"capacity": map[string]any{"availableMinutes": available, "occupiedMinutes": occupied, "freeMinutes": free, "formula": capacityFormula},
		"stats": map[string]any{
			"views": viewTotal, "visitors": visitorTotal, "clicks": clickTotal,
			"booked": booked, "cancelled": cancelled, "completed": completed, "sales": completed, "revenueToman": revenue,
			"prevViews": prevViews, "prevVisitors": prevVisitors, "prevClicks": prevClicks,
			"prevBooked": prevBooked, "prevCancelled": prevCancelled, "prevCompleted": prevCompleted, "prevRevenueToman": prevRevenue,
		},
		"series": map[string]any{
			"views": viewsSeries, "visitors": visitorSeries, "sales": salesSeries, "revenue": revenueSeries,
		},
	}, nil
}
