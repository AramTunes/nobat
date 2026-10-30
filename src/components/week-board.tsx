import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { businessBookingsFn } from "@/lib/api";
import { clockLabel, faNum, STATUS_FA, WEEKDAYS_FA } from "@/lib/booking/fa";
import { gregorianToJalali, jalaliMonthName } from "@/lib/booking/jalali";
import { addDaysYmd, civilInZone, todayYmd, zonedCivilToUtc } from "@/lib/booking/time";

type Span = { weekday: number; startMin: number; endMin: number };
type Booking = { id: string; customerName: string; serviceName: string; startsAt: string; status: string };

export function WeekBoard({
  businessId,
  timezone,
  weekly,
}: {
  businessId: string;
  timezone: string;
  weekly: Span[];
}) {
  const zone = timezone || "Asia/Tehran";
  const today = todayYmd(zone);
  const days = weekDays(zone);
  const [day, setDay] = useState(today);
  const [rows, setRows] = useState<Booking[] | null>(null);
  const selected = days.find((item) => item.ymd === day) ?? days[0];

  useEffect(() => {
    let live = true;
    setRows(null);
    businessBookingsFn({ data: { businessId, day } }).then((res) => {
      if (!live) return;
      setRows(res.ok ? res.data : []);
    });
    return () => {
      live = false;
    };
  }, [businessId, day]);

  const hours = hoursFor(weekly, selected.weekday);
  return (
    <Card>
      <h2 className="font-extrabold">امروز و هفته پیش رو</h2>
      <div className="mt-3 grid grid-cols-7 gap-1" role="tablist">
        {days.map((item) => {
          const active = item.ymd === day;
          return (
            <button
              key={item.ymd}
              type="button"
              role="tab"
              aria-selected={active}
              className={`flex flex-col items-center rounded-xl px-0.5 py-2 ${active ? "bg-ink font-bold text-on-ink" : "text-muted"}`}
              onClick={() => setDay(item.ymd)}
            >
              <span className="text-[11px] leading-4">{item.name}</span>
              <span className={`text-[10px] leading-4 ${active ? "text-on-ink/80" : ""}`}>{item.date}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-[4.5rem_1fr] border-b border-line px-3 py-2 text-sm font-bold">
          <div>ساعت</div>
          <div>{selected.name} {selected.date}</div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {rows === null ? <Skeleton className="m-3 h-40" /> : null}
          {rows && hours.length === 0 ? <p className="px-3 py-6 text-sm text-muted">ساعت کاری این روز تنظیم نشده.</p> : null}
          {rows && hours.map((hour) => {
            const items = rows.filter((row) => civilInZone(new Date(row.startsAt), zone).hour === hour);
            return (
              <div key={hour} className="grid min-h-12 grid-cols-[4.5rem_1fr] items-center border-b border-line px-3 py-2 text-sm last:border-0">
                <div className="font-semibold tabular-nums">{clockLabel(hour * 60)}</div>
                <div className="min-w-0">
                  {items.length === 0 ? <span className="text-muted">آزاد</span> : items.map((item) => (
                    <p key={item.id} className="truncate">
                      <span className="font-semibold">{item.customerName}</span>
                      <span className="text-muted"> · {item.serviceName} · {STATUS_FA[item.status] ?? item.status}</span>
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function weekDays(zone: string) {
  const today = todayYmd(zone);
  const weekday = civilInZone(zonedCivilToUtc({ ...parts(today), hour: 12, minute: 0 }, zone), zone).weekday;
  const start = addDaysYmd(today, -((weekday + 1) % 7), zone);
  return Array.from({ length: 7 }, (_, index) => {
    const ymd = addDaysYmd(start, index, zone);
    const civil = civilInZone(zonedCivilToUtc({ ...parts(ymd), hour: 12, minute: 0 }, zone), zone);
    const j = gregorianToJalali(civil.year, civil.month, civil.day);
    return {
      ymd,
      weekday: civil.weekday,
      name: WEEKDAYS_FA[civil.weekday],
      date: `${faNum(j.jd)} ${jalaliMonthName(j.jm)}`,
    };
  });
}

function parts(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

function hoursFor(weekly: Span[], weekday: number) {
  const spans = weekly.filter((item) => item.weekday === weekday);
  if (spans.length === 0) return [];
  const from = Math.floor(Math.min(...spans.map((item) => item.startMin)) / 60);
  const to = Math.ceil(Math.max(...spans.map((item) => item.endMin)) / 60);
  const hours: number[] = [];
  for (let hour = from; hour < to; hour += 1) {
    const begin = hour * 60;
    if (spans.some((item) => item.startMin < begin + 60 && item.endMin > begin)) hours.push(hour);
  }
  return hours;
}
