// Package booking is the pure slot engine: timezone conversion and free windows.
// Ported from the previous TypeScript implementation so a slot means the same instant.
package booking

import (
	"time"
	_ "time/tzdata"
)

type Civil struct {
	Year, Month, Day, Hour, Minute, Second, Weekday int
}

type Span struct {
	Start int
	End   int
}

type BusyInterval struct {
	StartsAt    time.Time
	BufferUntil time.Time
}

type StaffCalendar struct {
	StaffID string
	Windows []Span
	Breaks  []Span
	Busy    []BusyInterval
	Holiday bool
}

type SlotOption struct {
	Start    time.Time
	StaffIDs []string
}

func LoadZone(name string) (*time.Location, error) {
	return time.LoadLocation(name)
}

func YMD(year, month, day int) string {
	return sprintfDate(year, month, day)
}

func sprintfDate(year, month, day int) string {
	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
}

func ParseYMD(day string) (year, month, dayN int, ok bool) {
	t, err := time.Parse("2006-01-02", day)
	if err != nil {
		return 0, 0, 0, false
	}
	return t.Year(), int(t.Month()), t.Day(), true
}

func CivilInZone(instant time.Time, loc *time.Location) Civil {
	tt := instant.In(loc)
	return Civil{
		Year: tt.Year(), Month: int(tt.Month()), Day: tt.Day(),
		Hour: tt.Hour(), Minute: tt.Minute(), Second: tt.Second(),
		Weekday: int(tt.Weekday()),
	}
}

// ZonedCivilToUtc converts a wall-clock time to UTC with the same two-pass correction as the old engine.
// Hour may be 24; it overflows the same way Date.UTC does.
func ZonedCivilToUtc(c Civil, loc *time.Location) time.Time {
	desired := time.Date(c.Year, time.Month(c.Month), c.Day, c.Hour, c.Minute, c.Second, 0, time.UTC)
	utc := desired
	for i := 0; i < 2; i++ {
		got := CivilInZone(utc, loc)
		gotAsUTC := time.Date(got.Year, time.Month(got.Month), got.Day, got.Hour, got.Minute, got.Second, 0, time.UTC)
		next := utc.Add(desired.Sub(gotAsUTC))
		if next.Equal(utc) {
			break
		}
		utc = next
	}
	return utc.UTC()
}

func TodayYMD(loc *time.Location, now time.Time) string {
	c := CivilInZone(now, loc)
	return YMD(c.Year, c.Month, c.Day)
}

func AddDaysYMD(day string, days int, loc *time.Location) string {
	y, m, d, ok := ParseYMD(day)
	if !ok {
		return day
	}
	noon := ZonedCivilToUtc(Civil{Year: y, Month: m, Day: d, Hour: 12}, loc)
	next := CivilInZone(noon.Add(time.Duration(days)*24*time.Hour), loc)
	return YMD(next.Year, next.Month, next.Day)
}

func WeekdayOfYMD(day string, loc *time.Location) int {
	y, m, d, ok := ParseYMD(day)
	if !ok {
		return 0
	}
	noon := ZonedCivilToUtc(Civil{Year: y, Month: m, Day: d, Hour: 12}, loc)
	return CivilInZone(noon, loc).Weekday
}

func MinutesFromLocalMidnight(instant time.Time, day string, loc *time.Location) int {
	y, m, d, ok := ParseYMD(day)
	if !ok {
		return 0
	}
	midnight := ZonedCivilToUtc(Civil{Year: y, Month: m, Day: d}, loc)
	return int((instant.Sub(midnight) + 30*time.Second) / time.Minute)
}

func AtLocalMinute(day string, minute int, loc *time.Location) time.Time {
	y, m, d, ok := ParseYMD(day)
	if !ok {
		return time.Time{}
	}
	return ZonedCivilToUtc(Civil{Year: y, Month: m, Day: d, Hour: minute / 60, Minute: minute % 60}, loc)
}

func clean(span Span) (Span, bool) {
	if span.End <= span.Start {
		return Span{}, false
	}
	return span, true
}

func SubtractSpans(base, cuts []Span) []Span {
	parts := make([]Span, 0, len(base))
	for _, span := range base {
		if s, ok := clean(span); ok {
			parts = append(parts, s)
		}
	}
	for _, raw := range cuts {
		cut, ok := clean(raw)
		if !ok {
			continue
		}
		next := make([]Span, 0, len(parts)+1)
		for _, part := range parts {
			if cut.End <= part.Start || cut.Start >= part.End {
				next = append(next, part)
				continue
			}
			if cut.Start > part.Start {
				next = append(next, Span{Start: part.Start, End: cut.Start})
			}
			if cut.End < part.End {
				next = append(next, Span{Start: cut.End, End: part.End})
			}
		}
		parts = next
	}
	return parts
}

func SlotStarts(windows, breaks, busy []Span, durationMin, bufferMin, stepMin int, earliest *int) []int {
	if durationMin <= 0 || stepMin <= 0 {
		return nil
	}
	cuts := append(append([]Span{}, breaks...), busy...)
	open := SubtractSpans(windows, cuts)
	need := durationMin + max(0, bufferMin)
	var starts []int
	for _, window := range open {
		t := window.Start
		if earliest != nil && t < *earliest {
			t = *earliest
		}
		rem := ((t % stepMin) + stepMin) % stepMin
		if rem != 0 {
			t += stepMin - rem
		}
		for t+need <= window.End {
			starts = append(starts, t)
			t += stepMin
		}
	}
	return starts
}

func ClipDay(start, end int) (Span, bool) {
	s := max(0, start)
	e := min(24*60, end)
	if e <= s {
		return Span{}, false
	}
	return Span{Start: s, End: e}, true
}

func wallToUTC(day string, minuteOfDay int, loc *time.Location) (time.Time, bool) {
	dayOffset := minuteOfDay / 1440
	if minuteOfDay < 0 {
		dayOffset = -((-minuteOfDay + 1439) / 1440)
	}
	minute := minuteOfDay - dayOffset*1440
	dateDay := day
	if dayOffset != 0 {
		dateDay = AddDaysYMD(day, dayOffset, loc)
	}
	y, m, d, ok := ParseYMD(dateDay)
	if !ok {
		return time.Time{}, false
	}
	hour := minute / 60
	min := minute % 60
	utc := ZonedCivilToUtc(Civil{Year: y, Month: m, Day: d, Hour: hour, Minute: min}, loc)
	got := CivilInZone(utc, loc)
	if got.Year != y || got.Month != m || got.Day != d || got.Hour != hour || got.Minute != min {
		return time.Time{}, false
	}
	return utc, true
}

func overlaps(startMs, endMs, otherStart, otherEnd int64) bool {
	return startMs < otherEnd && otherStart < endMs
}

func SlotsForStaff(day string, loc *time.Location, windows, breaks []Span, busy []BusyInterval, durationMin, bufferMin, stepMin int, earliest *time.Time) []time.Time {
	if durationMin <= 0 || stepMin <= 0 {
		return nil
	}
	step := time.Duration(stepMin) * time.Minute
	need := time.Duration(durationMin+max(0, bufferMin)) * time.Minute
	var breaksUTC [][2]int64
	for _, br := range breaks {
		s, okS := wallToUTC(day, br.Start, loc)
		e, okE := wallToUTC(day, br.End, loc)
		if okS && okE && e.After(s) {
			breaksUTC = append(breaksUTC, [2]int64{s.UnixMilli(), e.UnixMilli()})
		}
	}
	busyUTC := make([][2]int64, 0, len(busy))
	for _, b := range busy {
		busyUTC = append(busyUTC, [2]int64{b.StartsAt.UnixMilli(), b.BufferUntil.UnixMilli()})
	}
	earliestMs := int64(-1 << 62)
	if earliest != nil {
		earliestMs = earliest.UnixMilli()
	}
	var out []time.Time
	for _, window := range windows {
		ws, okS := wallToUTC(day, window.Start, loc)
		we, okE := wallToUTC(day, window.End, loc)
		if !okS || !okE || !we.After(ws) {
			continue
		}
		t := ws.UnixMilli()
		if earliestMs > t {
			jumps := (earliestMs - t + step.Milliseconds() - 1) / step.Milliseconds()
			t += jumps * step.Milliseconds()
		}
		for t+need.Milliseconds() <= we.UnixMilli() {
			end := t + need.Milliseconds()
			blocked := false
			for _, b := range breaksUTC {
				if overlaps(t, end, b[0], b[1]) {
					blocked = true
					break
				}
			}
			if !blocked {
				for _, b := range busyUTC {
					if overlaps(t, end, b[0], b[1]) {
						blocked = true
						break
					}
				}
			}
			if !blocked {
				out = append(out, time.UnixMilli(t).UTC())
			}
			t += step.Milliseconds()
		}
	}
	return out
}

func DayAvailability(day string, loc *time.Location, now time.Time, durationMin, bufferMin, stepMin, minLeadMinutes, maxHorizonDays int, staff []StaffCalendar) []SlotOption {
	today := TodayYMD(loc, now)
	horizon := AddDaysYMD(today, maxHorizonDays, loc)
	if day < today || day > horizon {
		return nil
	}
	var earliest *time.Time
	if day == today {
		e := now.Add(time.Duration(minLeadMinutes) * time.Minute)
		earliest = &e
	}
	grouped := map[string][]string{}
	order := []string{}
	for _, member := range staff {
		if member.Holiday {
			continue
		}
		instants := SlotsForStaff(day, loc, member.Windows, member.Breaks, member.Busy, durationMin, bufferMin, stepMin, earliest)
		for _, instant := range instants {
			key := instant.UTC().Format(time.RFC3339Nano)
			if _, ok := grouped[key]; !ok {
				order = append(order, key)
			}
			grouped[key] = append(grouped[key], member.StaffID)
		}
	}
	// Sort by instant, not by map iteration. RFC3339Nano of UTC instants sorts chronologically.
	sortStrings(order)
	out := make([]SlotOption, 0, len(order))
	for _, key := range order {
		parsed, _ := time.Parse(time.RFC3339Nano, key)
		out = append(out, SlotOption{Start: parsed.UTC(), StaffIDs: grouped[key]})
	}
	return out
}

func sortStrings(values []string) {
	for i := 1; i < len(values); i++ {
		j := i
		for j > 0 && values[j] < values[j-1] {
			values[j], values[j-1] = values[j-1], values[j]
			j--
		}
	}
}

func OccupiedMinutesOnDay(busy []BusyInterval, day string, loc *time.Location) int {
	total := 0
	for _, item := range busy {
		start := MinutesFromLocalMidnight(item.StartsAt, day, loc)
		end := MinutesFromLocalMidnight(item.BufferUntil, day, loc)
		if clipped, ok := ClipDay(start, end); ok {
			total += clipped.End - clipped.Start
		}
	}
	return total
}

func ISO(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}
