import { clockLabel, faNum, WEEKDAYS_FA } from "./fa.ts";
import { gregorianToJalali, jalaliMonthName } from "./jalali.ts";
import { civilInZone } from "./time.ts";

export function formatWhen(iso: string, timeZone: string): string {
  const c = civilInZone(new Date(iso), timeZone);
  const j = gregorianToJalali(c.year, c.month, c.day);
  return `${WEEKDAYS_FA[c.weekday]} ${faNum(j.jd)} ${jalaliMonthName(j.jm)}، ${clockLabel(c.hour * 60 + c.minute)}`;
}

export function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const j = gregorianToJalali(y, m, d);
  return `${faNum(j.jd)} ${jalaliMonthName(j.jm)} ${faNum(j.jy)}`;
}

export function formatClock(iso: string, timeZone: string): string {
  const c = civilInZone(new Date(iso), timeZone);
  return clockLabel(c.hour * 60 + c.minute);
}
