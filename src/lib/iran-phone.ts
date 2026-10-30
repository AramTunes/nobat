import { enDigits } from "@/lib/booking/fa";

export { enDigits };

/** «۰۹۱۲…»، «+98912…» یا «0098912…» را به ده رقم «912…» برمی‌گرداند. */
export function normalizeIranMobile(input: string): string {
  let digits = enDigits(input).replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isIranMobile(input: string): boolean {
  return /^9\d{9}$/.test(normalizeIranMobile(input));
}

/** «912 345 6789» */
export function formatIranMobile(input: string): string {
  const digits = normalizeIranMobile(input);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(" ");
}

const OPERATORS: [RegExp, string][] = [
  [/^(91\d|99[0-6])/, "همراه اول"],
  [/^(93[0-9]|90[1-5])/, "ایرانسل"],
  [/^92[0-2]/, "رایتل"],
  [/^998/, "شاتل موبایل"],
  [/^999/, "سامانتل"],
];

export function mobileOperator(input: string): string | null {
  const digits = normalizeIranMobile(input);
  if (digits.length < 3) return null;
  return OPERATORS.find(([re]) => re.test(digits))?.[1] ?? null;
}
