package app

import (
	"path/filepath"
	"testing"
	"time"

	"nobatak/internal/booking"
)

func TestSignupAndBooking(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "nobat.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	svc := New(db)
	phone := "09120001122"
	sent, err := svc.SendCode(map[string]any{"phone": phone, "purpose": "signup"})
	if err != nil {
		t.Fatal(err)
	}
	code := sent.(map[string]any)["code"].(string)
	started, err := svc.StartAccount(map[string]any{
		"categoryId": "cat-beauty",
		"pageFor":    "business",
		"pageName":   "سالن آزمون",
		"username":   "salon_test",
		"phone":      phone,
		"code":       code,
	})
	if err != nil {
		t.Fatal(err)
	}
	token := started.(map[string]any)["token"].(string)
	userID, err := svc.UserID(token)
	if err != nil {
		t.Fatal(err)
	}
	me, err := svc.Me(userID)
	if err != nil {
		t.Fatal(err)
	}
	memberships := me.(map[string]any)["memberships"].([]map[string]any)
	if len(memberships) != 1 {
		t.Fatalf("memberships %#v", me)
	}
	biz := memberships[0]["businessId"].(string)
	saved, err := svc.SaveService(userID, map[string]any{
		"businessId": biz, "name": "اصلاح", "durationMinutes": 30, "bufferMinutes": 0, "priceToman": 1000,
	})
	if err != nil {
		t.Fatal(err)
	}
	serviceID := saved.(map[string]any)["serviceId"].(string)
	staffed, err := svc.SaveStaff(userID, map[string]any{
		"businessId": biz, "name": "نگار", "title": "آرایشگر", "serviceIds": []any{serviceID},
	})
	if err != nil {
		t.Fatal(err)
	}
	staffID := staffed.(map[string]any)["staffId"].(string)
	days := []any{}
	for weekday := 0; weekday < 7; weekday++ {
		days = append(days, map[string]any{"weekday": weekday, "enabled": true, "startMin": 8 * 60, "endMin": 20 * 60})
	}
	if _, err := svc.SaveSchedule(userID, map[string]any{"businessId": biz, "staffId": staffID, "days": days}); err != nil {
		t.Fatal(err)
	}
	loc, _ := booking.LoadZone("Asia/Tehran")
	day := booking.AddDaysYMD(booking.TodayYMD(loc, time.Now()), 1, loc)
	slots, err := svc.Availability(map[string]any{"businessId": biz, "serviceId": serviceID, "day": day})
	if err != nil {
		t.Fatal(err)
	}
	list := slots.(map[string]any)["slots"].([]map[string]any)
	if len(list) == 0 {
		t.Fatal("no slots")
	}
	start := list[0]["start"].(string)
	booked, err := svc.CreateBooking(userID, map[string]any{
		"businessId": biz, "serviceId": serviceID, "staffId": staffID, "start": start, "note": "", "idempotencyKey": "web-flow-test01",
	})
	if err != nil {
		t.Fatal(err)
	}
	if booked.(map[string]any)["status"] != "confirmed" {
		t.Fatalf("%#v", booked)
	}
	again, err := svc.CreateBooking(userID, map[string]any{
		"businessId": biz, "serviceId": serviceID, "staffId": staffID, "start": start, "note": "", "idempotencyKey": "web-flow-test01",
	})
	if err != nil {
		t.Fatal(err)
	}
	if again.(map[string]any)["id"] != booked.(map[string]any)["id"] {
		t.Fatal("idempotency replay failed")
	}
	_, err = svc.CreateBooking(userID, map[string]any{
		"businessId": biz, "serviceId": serviceID, "staffId": staffID, "start": start, "note": "", "idempotencyKey": "web-flow-test02",
	})
	if err == nil {
		t.Fatal("expected slot conflict")
	}
}
