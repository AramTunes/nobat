package app

import (
	"database/sql"
	"time"

	"nobatak/internal/booking"
)

var nextStatus = map[string][]string{
	"pending":   {"confirmed", "cancelled"},
	"confirmed": {"completed", "cancelled", "no_show"},
}

func (s *Service) CreateBooking(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.rate("book:"+userID, 10, time.Minute) {
		return nil, fail(429, "RATE_LIMIT", "تعداد درخواست زیاد است. کمی بعد دوباره تلاش کنید.")
	}
	input, err := parseBooking(raw)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	err = s.tx(func(tx *sql.Tx) error {
		dto, err := s.place(tx, userID, input)
		out = dto
		return err
	})
	if err == nil {
		return out, nil
	}
	if !isUnique(err) {
		return nil, err
	}
	var id, createdBy string
	var customerUser sql.NullString
	qerr := s.db.QueryRow(`SELECT id, created_by_user_id, customer_user_id FROM bookings WHERE business_id = ? AND idempotency_key = ?`, input.businessID, input.key).Scan(&id, &createdBy, &customerUser)
	if qerr != nil {
		return nil, err
	}
	if createdBy != userID && customerUser.String != userID {
		return nil, fail(403, "FORBIDDEN", "این شناسه تکرار متعلق به شما نیست")
	}
	row, lerr := s.loadBooking(s.db, id)
	if lerr != nil {
		return nil, lerr
	}
	return bookDTO(row, true), nil
}

type bookInput struct {
	businessID, serviceID, start, key, note string
	staffID                                  string
	manual                                   *struct{ name, phone string }
}

func parseBooking(raw map[string]any) (bookInput, error) {
	var in bookInput
	var err error
	in.businessID, err = textOf(raw, "businessId", 80, "")
	if err != nil {
		return in, err
	}
	in.serviceID, err = textOf(raw, "serviceId", 80, "")
	if err != nil {
		return in, err
	}
	in.staffID, err = textOf(raw, "staffId", 80, "")
	if err != nil {
		return in, err
	}
	in.note, err = textOf(raw, "note", 500, "")
	if err != nil {
		return in, err
	}
	in.key, err = textOf(raw, "idempotencyKey", 80, "")
	if err != nil {
		return in, err
	}
	if !keyRe.MatchString(in.key) {
		return in, fail(400, "VALIDATION", "شناسه تکرار درخواست نامعتبر است")
	}
	start, err := parseISO(raw["start"])
	if err != nil {
		return in, err
	}
	in.start = booking.ISO(start)
	name, _ := textOf(raw, "customerName", 80, "")
	if isTrue(raw, "manual") {
		if len([]rune(name)) < 2 {
			return in, fail(400, "VALIDATION", "نام مشتری را وارد کنید")
		}
		phone, _ := textOf(raw, "customerPhone", 20, "")
		in.manual = &struct{ name, phone string }{name, phone}
	}
	return in, nil
}

func (s *Service) place(tx *sql.Tx, userID string, in bookInput) (map[string]any, error) {
	b, err := loadBiz(tx, "id = ?", in.businessID)
	if err != nil {
		if f, ok := err.(*Fail); ok && f.Code == "NOT_FOUND" {
			return nil, fail(403, "FORBIDDEN", "رزرو این کسب‌وکار ممکن نیست")
		}
		return nil, err
	}
	if b.Status != "active" {
		return nil, fail(403, "FORBIDDEN", "رزرو این کسب‌وکار ممکن نیست")
	}
	var replayID, createdBy string
	var customerUser sql.NullString
	err = tx.QueryRow(`SELECT id, created_by_user_id, customer_user_id FROM bookings WHERE business_id = ? AND idempotency_key = ?`, b.ID, in.key).Scan(&replayID, &createdBy, &customerUser)
	if err == nil {
		if createdBy != userID && customerUser.String != userID {
			return nil, fail(403, "FORBIDDEN", "این شناسه تکرار متعلق به شما نیست")
		}
		row, err := s.loadBooking(tx, replayID)
		if err != nil {
			return nil, err
		}
		return bookDTO(row, true), nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	if in.manual != nil {
		if _, err := s.requireRole(tx, userID, b.ID, "owner", "manager", "staff"); err != nil {
			return nil, err
		}
	}
	var branch sql.NullString
	var dur, buf, active int
	var svcName string
	err = tx.QueryRow(`SELECT branch_id, duration_minutes, buffer_minutes, active, name FROM services WHERE id = ? AND business_id = ?`, in.serviceID, b.ID).Scan(&branch, &dur, &buf, &active, &svcName)
	if err != nil || active == 0 {
		return nil, fail(404, "NOT_FOUND", "خدمت پیدا نشد")
	}
	start, _ := time.Parse(time.RFC3339Nano, in.start)
	loc := mustZone(b.Timezone)
	civil := booking.CivilInZone(start, loc)
	day := booking.YMD(civil.Year, civil.Month, civil.Day)
	var only *string
	if in.staffID != "" {
		only = &in.staffID
	}
	rows, err := s.calendars(tx, b, in.serviceID, day, only, nil)
	if err != nil {
		return nil, err
	}
	if in.staffID == "" && !b.AllowAny {
		return nil, fail(400, "VALIDATION", "انتخاب متخصص برای این کسب‌وکار الزامی است")
	}
	cals := make([]booking.StaffCalendar, 0, len(rows))
	names := map[string]string{}
	for _, row := range rows {
		cals = append(cals, row.Cal)
		names[row.ID] = row.Name
	}
	slots := booking.DayAvailability(day, loc, s.now(), dur, buf, b.Step, b.MinLead, b.Horizon, cals)
	var match *booking.SlotOption
	for i := range slots {
		if booking.ISO(slots[i].Start) == booking.ISO(start) || slots[i].Start.Equal(start) {
			match = &slots[i]
			break
		}
	}
	if match == nil {
		return nil, fail(409, "SLOT_TAKEN", "این زمان دیگر آزاد نیست")
	}
	chosen := ""
	if in.staffID != "" {
		for _, id := range match.StaffIDs {
			if id == in.staffID {
				chosen = id
				break
			}
		}
	}
	if chosen == "" && len(match.StaffIDs) > 0 && in.staffID == "" {
		chosen = match.StaffIDs[0]
	}
	if chosen == "" && in.staffID != "" {
		return nil, fail(409, "SLOT_TAKEN", "متخصصی برای این زمان آزاد نیست")
	}
	if chosen == "" {
		return nil, fail(409, "SLOT_TAKEN", "متخصصی برای این زمان آزاد نیست")
	}
	branchID := branch.String
	if branchID == "" {
		_ = tx.QueryRow(`SELECT branch_id FROM staff WHERE id = ?`, chosen).Scan(&branchID)
	}
	if branchID == "" {
		return nil, fail(400, "VALIDATION", "شعبه خدمت مشخص نیست")
	}
	var customerID string
	var custUser any
	if in.manual != nil {
		customerID, err = s.customerManual(tx, b.ID, in.manual.name, in.manual.phone)
		custUser = nil
	} else {
		customerID, err = s.customerOnline(tx, b.ID, userID)
		custUser = userID
	}
	if err != nil {
		return nil, err
	}
	ends := start.Add(time.Duration(dur) * time.Minute)
	bufferUntil := start.Add(time.Duration(dur+buf) * time.Minute)
	bookingID := newID()
	var clash string
	err = tx.QueryRow(`SELECT id FROM bookings WHERE staff_id = ? AND status IN ('confirmed','pending') AND starts_at < ? AND buffer_until > ?`,
		chosen, booking.ISO(bufferUntil), booking.ISO(start)).Scan(&clash)
	if err == nil {
		return nil, fail(409, "SLOT_TAKEN", "این زمان همین حالا رزرو شد")
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	now := s.now().UTC().Format(time.RFC3339)
	source := "online"
	if in.manual != nil {
		source = "manual"
	}
	_, err = tx.Exec(`INSERT INTO bookings (
		id, business_id, branch_id, service_id, staff_id, customer_id, customer_user_id, created_by_user_id,
		starts_at, ends_at, buffer_until, status, source, idempotency_key, note, created_at, updated_at
	) VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,?,?,?)`,
		bookingID, b.ID, branchID, in.serviceID, chosen, customerID, custUser, userID,
		booking.ISO(start), booking.ISO(ends), booking.ISO(bufferUntil), source, in.key, in.note, now, now)
	if err != nil {
		return nil, err
	}
	when := start.In(loc).Format("2006-01-02 15:04")
	ids := append([]string{}, s.memberIDs(tx, b.ID)...)
	if in.manual == nil {
		ids = append(ids, userID)
	}
	s.notify(tx, ids, b.ID, bookingID, "booking_created", "نوبت ثبت شد", svcName+" با "+names[chosen]+"، "+when+". این پیام فقط اعلان داخلی است.")
	_ = s.audit(tx, userID, "create_booking", "booking", strPtr(bookingID), strPtr(b.ID), svcName)
	row, err := s.loadBooking(tx, bookingID)
	if err != nil {
		return nil, err
	}
	return bookDTO(row, true), nil
}

func (s *Service) SetStatus(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bookingID, _ := textOf(raw, "bookingId", 80, "")
	status, _ := textOf(raw, "status", 20, "")
	reason, _ := textOf(raw, "reason", 200, "")
	var out map[string]any
	err := s.tx(func(tx *sql.Tx) error {
		row, err := s.loadBooking(tx, bookingID)
		if err != nil {
			return err
		}
		role, err := s.roleOf(tx, userID, row.BusinessID)
		if err != nil {
			return err
		}
		isCustomer := row.CustomerUser.Valid && row.CustomerUser.String == userID
		if role == "" && !isCustomer {
			return fail(403, "FORBIDDEN", "به این نوبت دسترسی ندارید")
		}
		if role == "" && status != "cancelled" {
			return fail(403, "FORBIDDEN", "فقط کسب‌وکار می‌تواند این وضعیت را عوض کند")
		}
		ok := false
		for _, next := range nextStatus[row.Status] {
			if next == status {
				ok = true
			}
		}
		if !ok {
			return fail(409, "POLICY", "این تغییر وضعیت مجاز نیست")
		}
		if isCustomer && role == "" && status == "cancelled" {
			if err := s.assertWindow(tx, row); err != nil {
				return err
			}
		}
		cancel := row.Reason
		if status == "cancelled" {
			cancel = reason
		}
		if _, err := tx.Exec(`UPDATE bookings SET status = ?, cancel_reason = ?, updated_at = ? WHERE id = ?`, status, cancel, s.now().UTC().Format(time.RFC3339), bookingID); err != nil {
			return err
		}
		titles := map[string]string{"cancelled": "نوبت لغو شد", "completed": "نوبت انجام شد", "no_show": "عدم مراجعه ثبت شد", "confirmed": "نوبت تأیید شد"}
		title := titles[status]
		if title == "" {
			title = "وضعیت نوبت عوض شد"
		}
		ids := append(s.memberIDs(tx, row.BusinessID), row.CustomerUser.String)
		s.notify(tx, ids, row.BusinessID, bookingID, "booking_"+status, title, row.ServiceName+". این پیام فقط اعلان داخلی است.")
		_ = s.audit(tx, userID, "booking_status", "booking", strPtr(bookingID), strPtr(row.BusinessID), status)
		next, err := s.loadBooking(tx, bookingID)
		if err != nil {
			return err
		}
		out = bookDTO(next, role != "" || isCustomer)
		return nil
	})
	return out, err
}

func (s *Service) assertWindow(q querier, row bookRow) error {
	b, err := loadBiz(q, "id = ?", row.BusinessID)
	if err != nil {
		return err
	}
	start, err := time.Parse(time.RFC3339Nano, row.Starts)
	if err != nil {
		return err
	}
	if start.Sub(s.now()) < time.Duration(b.CancelBefore)*time.Minute {
		return fail(409, "POLICY", "مهلت لغو یا جابه‌جایی این نوبت گذشته است")
	}
	return nil
}

func (s *Service) Reschedule(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bookingID, _ := textOf(raw, "bookingId", 80, "")
	staffID, _ := textOf(raw, "staffId", 80, "")
	start, err := parseISO(raw["start"])
	if err != nil {
		return nil, err
	}
	var out map[string]any
	err = s.tx(func(tx *sql.Tx) error {
		row, err := s.loadBooking(tx, bookingID)
		if err != nil {
			return err
		}
		b, err := loadBiz(tx, "id = ?", row.BusinessID)
		if err != nil {
			return err
		}
		role, err := s.roleOf(tx, userID, b.ID)
		if err != nil {
			return err
		}
		isCustomer := row.CustomerUser.Valid && row.CustomerUser.String == userID
		if role == "" && !isCustomer {
			return fail(403, "FORBIDDEN", "به این نوبت دسترسی ندارید")
		}
		if row.Status != "confirmed" && row.Status != "pending" {
			return fail(409, "POLICY", "این نوبت قابل جابه‌جایی نیست")
		}
		if isCustomer && role == "" {
			if err := s.assertWindow(tx, row); err != nil {
				return err
			}
		}
		var branch sql.NullString
		var dur, buf, active int
		if err := tx.QueryRow(`SELECT branch_id, duration_minutes, buffer_minutes, active FROM services WHERE id = ?`, row.ServiceID).Scan(&branch, &dur, &buf, &active); err != nil || active == 0 {
			return fail(409, "POLICY", "خدمت دیگر فعال نیست")
		}
		loc := mustZone(b.Timezone)
		civil := booking.CivilInZone(start, loc)
		day := booking.YMD(civil.Year, civil.Month, civil.Day)
		var only *string
		if staffID != "" {
			only = &staffID
		}
		people, err := s.calendars(tx, b, row.ServiceID, day, only, &bookingID)
		if err != nil {
			return err
		}
		cals := make([]booking.StaffCalendar, 0, len(people))
		for _, p := range people {
			cals = append(cals, p.Cal)
		}
		slots := booking.DayAvailability(day, loc, s.now(), dur, buf, b.Step, b.MinLead, b.Horizon, cals)
		var match *booking.SlotOption
		for i := range slots {
			if slots[i].Start.Equal(start) || booking.ISO(slots[i].Start) == booking.ISO(start) {
				match = &slots[i]
				break
			}
		}
		if match == nil {
			return fail(409, "SLOT_TAKEN", "زمان جدید آزاد نیست")
		}
		chosen := ""
		if staffID != "" {
			for _, id := range match.StaffIDs {
				if id == staffID {
					chosen = id
				}
			}
		}
		if chosen == "" && len(match.StaffIDs) > 0 {
			if staffID == "" {
				chosen = match.StaffIDs[0]
			}
		}
		if chosen == "" {
			return fail(409, "SLOT_TAKEN", "متخصصی برای این زمان آزاد نیست")
		}
		ends := start.Add(time.Duration(dur) * time.Minute)
		bufferUntil := start.Add(time.Duration(dur+buf) * time.Minute)
		branchID := branch.String
		if branchID == "" {
			_ = tx.QueryRow(`SELECT branch_id FROM staff WHERE id = ?`, chosen).Scan(&branchID)
		}
		if branchID == "" {
			return fail(400, "VALIDATION", "شعبه خدمت مشخص نیست")
		}
		var clash string
		err = tx.QueryRow(`SELECT id FROM bookings WHERE staff_id = ? AND status IN ('confirmed','pending') AND starts_at < ? AND buffer_until > ? AND id <> ?`,
			chosen, booking.ISO(bufferUntil), booking.ISO(start), bookingID).Scan(&clash)
		if err == nil {
			return fail(409, "SLOT_TAKEN", "زمان جدید همین حالا گرفته شد")
		}
		if err != sql.ErrNoRows {
			return err
		}
		res, err := tx.Exec(`UPDATE bookings SET staff_id=?, starts_at=?, ends_at=?, buffer_until=?, service_id=?, branch_id=?, updated_at=? WHERE id=? AND business_id=? AND status IN ('confirmed','pending')`,
			chosen, booking.ISO(start), booking.ISO(ends), booking.ISO(bufferUntil), row.ServiceID, branchID, s.now().UTC().Format(time.RFC3339), bookingID, b.ID)
		if err != nil {
			return err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return fail(409, "SLOT_TAKEN", "زمان جدید همین حالا گرفته شد")
		}
		ids := append(s.memberIDs(tx, b.ID), row.CustomerUser.String)
		s.notify(tx, ids, b.ID, bookingID, "booking_rescheduled", "نوبت جابه‌جا شد", row.ServiceName+". این پیام فقط اعلان داخلی است.")
		_ = s.audit(tx, userID, "reschedule", "booking", strPtr(bookingID), strPtr(b.ID), "")
		next, err := s.loadBooking(tx, bookingID)
		if err != nil {
			return err
		}
		out = bookDTO(next, role != "" || isCustomer)
		return nil
	})
	return out, err
}

func (s *Service) Notifications(userID string) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows, err := s.db.Query(`SELECT id, title, body, kind, channel, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title, body, kind, channel, created string
		var read sql.NullString
		if err := rows.Scan(&id, &title, &body, &kind, &channel, &read, &created); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "title": title, "body": body, "kind": kind, "channel": channel, "read": read.Valid, "createdAt": created})
	}
	return out, rows.Err()
}

func (s *Service) MarkRead(userID string, raw map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, _ := textOf(raw, "notificationId", 80, "")
	now := s.now().UTC().Format(time.RFC3339)
	if id != "" {
		_, err := s.db.Exec(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`, now, id, userID)
		return map[string]any{"ok": true}, err
	}
	_, err := s.db.Exec(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, now, userID)
	return map[string]any{"ok": true}, err
}
