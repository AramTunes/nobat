package booking

import (
	"testing"
	"time"
)

func TestTehranRoundTrip(t *testing.T) {
	loc, err := LoadZone("Asia/Tehran")
	if err != nil {
		t.Fatal(err)
	}
	morning := ZonedCivilToUtc(Civil{Year: 2026, Month: 10, Day: 22, Hour: 0, Minute: 30}, loc)
	night := ZonedCivilToUtc(Civil{Year: 2026, Month: 10, Day: 22, Hour: 23, Minute: 30}, loc)
	if got := morning.Format(time.RFC3339); got != "2026-10-21T21:00:00Z" {
		t.Fatalf("morning %s", got)
	}
	if got := night.Format(time.RFC3339); got != "2026-10-22T20:00:00Z" {
		t.Fatalf("night %s", got)
	}
	if CivilInZone(morning, loc).Day != 22 || CivilInZone(night, loc).Hour != 23 {
		t.Fatal("civil mismatch")
	}
}

func TestNoSlotPastMidnight(t *testing.T) {
	loc, _ := LoadZone("Asia/Tehran")
	slots := SlotsForStaff("2026-10-22", loc, []Span{{Start: 22 * 60, End: 24 * 60}}, nil, nil, 60, 0, 30, nil)
	var labels []string
	for _, slot := range slots {
		c := CivilInZone(slot, loc)
		labels = append(labels, itoa(c.Hour)+":"+itoa(c.Minute))
	}
	want := []string{"22:0", "22:30", "23:0"}
	if len(labels) != len(want) {
		t.Fatalf("got %v", labels)
	}
	for i := range want {
		if labels[i] != want[i] {
			t.Fatalf("got %v", labels)
		}
	}
}

func TestSubtractAndBuffer(t *testing.T) {
	open := SubtractSpans([]Span{{Start: 9 * 60, End: 18 * 60}}, []Span{{Start: 13 * 60, End: 14 * 60}, {Start: 10 * 60, End: 11 * 60}})
	if len(open) != 3 || open[0].Start != 9*60 || open[2].End != 18*60 {
		t.Fatalf("%+v", open)
	}
	starts := SlotStarts([]Span{{Start: 9 * 60, End: 11 * 60}}, nil, nil, 60, 15, 15, nil)
	if len(starts) != 4 || starts[0] != 9*60 || starts[3] != 9*60+45 {
		t.Fatalf("%v", starts)
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
