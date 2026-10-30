import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { faNum, WEEKDAYS_FA } from "@/lib/booking/fa";
import { gregorianToJalali, jalaliMonthName, jalaliToGregorian, monthLength } from "@/lib/booking/jalali";
import { ymd } from "@/lib/booking/time";
import { cn } from "@/lib/cn";

const COLS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function shiftMonth(jy: number, jm: number, delta: number) {
  const index = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
}

export function JalaliCalendar({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
}) {
  const selected = useMemo(() => {
    const [y, m, d] = value.split("-").map(Number);
    return gregorianToJalali(y, m, d);
  }, [value]);
  const [cursor, setCursor] = useState({ jy: selected.jy, jm: selected.jm });
  const length = monthLength(cursor.jy, cursor.jm);
  const first = jalaliToGregorian(cursor.jy, cursor.jm, 1);
  const offset = (new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay() + 1) % 7;
  const cells: Array<{ day: number; ymd: string } | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length }, (_, i) => {
      const g = jalaliToGregorian(cursor.jy, cursor.jm, i + 1);
      return { day: i + 1, ymd: ymd(g.gy, g.gm, g.gd) };
    }),
  ];
  return (
    <div className="rounded-card border border-line bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-paper" onClick={() => setCursor(shiftMonth(cursor.jy, cursor.jm, -1))} aria-label="ماه قبل">
          <ChevronRight className="size-5" />
        </button>
        <div className="font-semibold">
          {jalaliMonthName(cursor.jm)} {faNum(cursor.jy)}
        </div>
        <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-paper" onClick={() => setCursor(shiftMonth(cursor.jy, cursor.jm, 1))} aria-label="ماه بعد">
          <ChevronLeft className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {COLS.map((col) => (
          <div key={col} className="py-1">{col}</div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <div key={`e-${index}`} />;
          const disabled = (min && cell.ymd < min) || (max && cell.ymd > max);
          const active = cell.ymd === value;
          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={Boolean(disabled)}
              onClick={() => onChange(cell.ymd)}
              className={cn(
                "min-h-11 rounded-lg text-sm tabular-nums disabled:text-muted/40",
                active ? "bg-jade font-semibold text-on-jade" : "hover:bg-paper",
              )}
            >
              {faNum(cell.day)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted">{WEEKDAYS_FA[new Date(`${value}T12:00:00Z`).getUTCDay()]}</p>
    </div>
  );
}
