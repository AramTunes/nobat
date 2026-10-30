export type Civil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function civilInZone(date: Date, timeZone: string): Civil {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY[get("weekday")] ?? 0,
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. Two-pass offset correction. */
export function zonedCivilToUtc(
  c: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const desired = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, 0);
  let utc = desired;
  for (let i = 0; i < 2; i += 1) {
    const got = civilInZone(new Date(utc), timeZone);
    const gotAsUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const next = utc + (desired - gotAsUtc);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

export function todayYmd(timeZone: string, now = new Date()): string {
  const c = civilInZone(now, timeZone);
  return ymd(c.year, c.month, c.day);
}

export function addDaysYmd(day: string, days: number, timeZone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const noon = zonedCivilToUtc({ year: y, month: m, day: d, hour: 12, minute: 0 }, timeZone);
  const next = civilInZone(new Date(noon.getTime() + days * 86_400_000), timeZone);
  return ymd(next.year, next.month, next.day);
}

export function weekdayOfYmd(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const noon = zonedCivilToUtc({ year: y, month: m, day: d, hour: 12, minute: 0 }, timeZone);
  return civilInZone(noon, timeZone).weekday;
}

/** Minutes from local midnight of `day` to `instant` (may be negative or > 1440). */
export function minutesFromLocalMidnight(instant: Date, day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const midnight = zonedCivilToUtc({ year: y, month: m, day: d, hour: 0, minute: 0 }, timeZone);
  return Math.round((instant.getTime() - midnight.getTime()) / 60_000);
}

export function atLocalMinute(day: string, minute: number, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return zonedCivilToUtc({ year: y, month: m, day: d, hour, minute: min }, timeZone);
}
