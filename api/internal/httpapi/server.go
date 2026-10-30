package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"nobatak/internal/app"
)

type Server struct {
	App *app.Service
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeOK(w, map[string]any{"service": "nobatak", "time": "ok"})
	})
	mux.HandleFunc("GET /api/v1/categories", func(w http.ResponseWriter, r *http.Request) {
		s.send(w, func() (any, error) { return s.App.ListCategories() })
	})
	mux.HandleFunc("GET /api/v1/businesses", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		limit, _ := strconv.Atoi(q.Get("limit"))
		offset, _ := strconv.Atoi(q.Get("offset"))
		s.send(w, func() (any, error) { return s.App.ListBusinesses(q.Get("q"), q.Get("category"), limit, offset) })
	})
	mux.HandleFunc("GET /api/v1/business/{slug}", func(w http.ResponseWriter, r *http.Request) {
		s.send(w, func() (any, error) { return s.App.PublicBusiness(r.PathValue("slug"), r.URL.Query().Get("v")) })
	})
	mux.HandleFunc("POST /api/v1/business/{slug}/click", func(w http.ResponseWriter, r *http.Request) {
		s.send(w, func() (any, error) { return s.App.NoteClick(r.PathValue("slug")) })
	})
	mux.HandleFunc("GET /api/v1/availability", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		s.send(w, func() (any, error) {
			return s.App.Availability(map[string]any{
				"businessId": q.Get("businessId"), "serviceId": q.Get("serviceId"), "staffId": q.Get("staffId"), "day": q.Get("day"),
			})
		})
	})
	mux.HandleFunc("GET /api/v1/session", func(w http.ResponseWriter, r *http.Request) {
		user, _ := s.App.Session(bearer(r))
		writeOK(w, map[string]any{"user": user})
	})
	mux.HandleFunc("POST /api/v1/auth/lookup", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.LookupPhone(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/code", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.SendCode(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/password", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.SignInPassword(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/code-login", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.SignInCode(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/reset", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.ResetPassword(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/start", func(w http.ResponseWriter, r *http.Request) { s.send(w, func() (any, error) { return s.App.StartAccount(body(r)) }) })
	mux.HandleFunc("POST /api/v1/auth/signout", func(w http.ResponseWriter, r *http.Request) {
		s.App.SignOut(bearer(r))
		writeOK(w, map[string]any{"ok": true})
	})

	auth := func(next func(userID string, raw map[string]any) (any, error)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			id, err := s.App.UserID(bearer(r))
			if err != nil {
				s.ok(w, nil, err)
				return
			}
			s.send(w, func() (any, error) { return next(id, body(r)) })
		}
	}
	mux.HandleFunc("GET /api/v1/me", auth(func(id string, _ map[string]any) (any, error) { return s.App.Me(id) }))
	mux.HandleFunc("POST /api/v1/me", auth(func(id string, raw map[string]any) (any, error) { return s.App.UpdateProfile(id, raw) }))
	mux.HandleFunc("POST /api/v1/admin/claim", auth(func(id string, _ map[string]any) (any, error) { return s.App.ClaimAdmin(id) }))
	mux.HandleFunc("POST /api/v1/businesses", auth(func(id string, raw map[string]any) (any, error) { return s.App.CreateBusiness(id, raw) }))
	mux.HandleFunc("POST /api/v1/demo", auth(func(id string, _ map[string]any) (any, error) { return s.App.CreateDemo(id) }))
	mux.HandleFunc("POST /api/v1/businesses/update", auth(func(id string, raw map[string]any) (any, error) { return s.App.UpdateBusiness(id, raw) }))
	mux.HandleFunc("POST /api/v1/businesses/delete", auth(func(id string, raw map[string]any) (any, error) {
		bid, _ := raw["businessId"].(string)
		return s.App.DeleteBusiness(id, bid)
	}))
	mux.HandleFunc("POST /api/v1/businesses/manage", auth(func(id string, raw map[string]any) (any, error) {
		bid, _ := raw["businessId"].(string)
		return s.App.ManageBusiness(id, bid)
	}))
	mux.HandleFunc("POST /api/v1/services", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveService(id, raw) }))
	mux.HandleFunc("POST /api/v1/staff", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveStaff(id, raw) }))
	mux.HandleFunc("POST /api/v1/schedule", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveSchedule(id, raw) }))
	mux.HandleFunc("POST /api/v1/holidays", auth(func(id string, raw map[string]any) (any, error) { return s.App.AddHoliday(id, raw) }))
	mux.HandleFunc("POST /api/v1/holidays/remove", auth(func(id string, raw map[string]any) (any, error) { return s.App.RemoveHoliday(id, raw) }))
	mux.HandleFunc("POST /api/v1/bookings", auth(func(id string, raw map[string]any) (any, error) { return s.App.CreateBooking(id, raw) }))
	mux.HandleFunc("POST /api/v1/bookings/status", auth(func(id string, raw map[string]any) (any, error) { return s.App.SetStatus(id, raw) }))
	mux.HandleFunc("POST /api/v1/bookings/reschedule", auth(func(id string, raw map[string]any) (any, error) { return s.App.Reschedule(id, raw) }))
	mux.HandleFunc("GET /api/v1/me/bookings", auth(func(id string, _ map[string]any) (any, error) { return s.App.MyBookings(id) }))
	mux.HandleFunc("POST /api/v1/business-bookings", auth(func(id string, raw map[string]any) (any, error) { return s.App.BusinessBookings(id, raw) }))
	mux.HandleFunc("POST /api/v1/customers/list", auth(func(id string, raw map[string]any) (any, error) { return s.App.ListCustomers(id, raw) }))
	mux.HandleFunc("POST /api/v1/customers", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveCustomer(id, raw) }))
	mux.HandleFunc("POST /api/v1/dashboard", auth(func(id string, raw map[string]any) (any, error) { return s.App.Dashboard(id, raw) }))
	mux.HandleFunc("GET /api/v1/notifications", auth(func(id string, _ map[string]any) (any, error) { return s.App.Notifications(id) }))
	mux.HandleFunc("POST /api/v1/notifications/read", auth(func(id string, raw map[string]any) (any, error) { return s.App.MarkRead(id, raw) }))
	mux.HandleFunc("GET /api/v1/admin/overview", auth(func(id string, _ map[string]any) (any, error) { return s.App.AdminOverview(id) }))
	mux.HandleFunc("POST /api/v1/admin/users", auth(func(id string, raw map[string]any) (any, error) { return s.App.AdminUsers(id, raw) }))
	mux.HandleFunc("POST /api/v1/admin/businesses", auth(func(id string, raw map[string]any) (any, error) { return s.App.AdminBusinesses(id, raw) }))
	mux.HandleFunc("POST /api/v1/admin/moderate", auth(func(id string, raw map[string]any) (any, error) { return s.App.Moderate(id, raw) }))
	mux.HandleFunc("GET /api/v1/admin/categories", auth(func(id string, _ map[string]any) (any, error) { return s.App.AdminCategories(id) }))
	mux.HandleFunc("POST /api/v1/admin/categories", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveCategory(id, raw) }))
	mux.HandleFunc("GET /api/v1/admin/audit", auth(func(id string, _ map[string]any) (any, error) { return s.App.AdminAudit(id) }))
	mux.HandleFunc("POST /api/v1/admin/settings", auth(func(id string, raw map[string]any) (any, error) { return s.App.SaveSettings(id, raw) }))
	return mux
}

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

func body(r *http.Request) map[string]any {
	if r.Body == nil {
		return map[string]any{}
	}
	defer r.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if len(raw) == 0 {
		return map[string]any{}
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		return map[string]any{}
	}
	return m
}

func (s *Server) send(w http.ResponseWriter, fn func() (any, error)) {
	data, err := fn()
	s.ok(w, data, err)
}

func (s *Server) ok(w http.ResponseWriter, data any, err error) {
	if err != nil {
		status, msg, code := 500, "خطای داخلی. دوباره تلاش کنید.", "INTERNAL"
		if p, ok := err.(interface{ Parts() (int, string, string) }); ok {
			status, code, msg = p.Parts()
		}
		w.Header().Set("content-type", "application/json; charset=utf-8")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": msg, "code": code})
		return
	}
	writeOK(w, data)
}

func writeOK(w http.ResponseWriter, data any) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "data": data})
}
