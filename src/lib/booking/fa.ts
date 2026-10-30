const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

export function enDigits(input: string): string {
  return String(input).replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = DIGITS.indexOf(ch);
    if (fa >= 0) return String(fa);
    const ar = ARABIC.indexOf(ch);
    return ar >= 0 ? String(ar) : ch;
  });
}

export function faNum(value: number | string): string {
  return String(value).replace(/\d/g, (d) => DIGITS[Number(d)] ?? d);
}

export function toman(amount: number): string {
  const grouped = Math.max(0, Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return `${faNum(grouped)} تومان`;
}

export function minutesLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`;
  if (h) return `${faNum(h)} ساعت`;
  return `${faNum(m)} دقیقه`;
}

export function clockLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return faNum(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export const STATUS_FA: Record<string, string> = {
  pending: "در انتظار",
  confirmed: "تأییدشده",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  no_show: "عدم مراجعه",
};

export const ROLE_FA: Record<string, string> = {
  owner: "مالک",
  manager: "مدیر",
  staff: "کارمند",
};
