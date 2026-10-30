import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

export type JDate = { jy: number; jm: number; jd: number };

export function gregorianToJalali(year: number, month: number, day: number): JDate {
  return toJalaali(year, month, day);
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): {
  gy: number;
  gm: number;
  gd: number;
} {
  return toGregorian(jy, jm, jd);
}

export function monthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

const JMONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function jalaliMonthName(jm: number): string {
  return JMONTHS[jm - 1] ?? "";
}

export function formatJalaliYmd(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const j = toJalaali(y, m, d);
  return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
}
