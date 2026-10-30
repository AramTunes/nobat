import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { faNum } from "@/lib/booking/fa";
import { formatIranMobile, isIranMobile, mobileOperator, normalizeIranMobile } from "@/lib/iran-phone";

export function PhoneInput({
  value,
  onChange,
  className,
  id,
  autoFocus,
}: {
  value?: string;
  onChange?: (digits: string, valid: boolean) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const [internal, setInternal] = useState("");
  const digits = normalizeIranMobile(value ?? internal);
  const valid = isIranMobile(digits);
  const operator = mobileOperator(digits);

  function set(next: string) {
    const normalized = normalizeIranMobile(next);
    if (value === undefined) setInternal(normalized);
    onChange?.(normalized, isIranMobile(normalized));
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 focus-within:border-jade",
          digits.length === 10 && !valid ? "border-danger" : "border-line",
        )}
        dir="ltr"
      >
        <span className="text-sm text-muted">{faNum("+98")}</span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={faNum(formatIranMobile(digits))}
          onChange={(e) => set(e.target.value)}
          placeholder={faNum("912 345 6789")}
          aria-invalid={digits.length === 10 && !valid ? true : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted/50"
        />
        {valid ? <Check className="size-4 shrink-0 text-jade" aria-hidden="true" /> : null}
      </div>
      <p className="text-[11px] leading-5 text-muted">
        {operator ? (
          `اپراتور: ${operator}`
        ) : digits.length === 10 && !valid ? (
          <span className="text-danger">شماره باید با ۹ شروع شود و ۱۰ رقم باشد</span>
        ) : (
          "بدون صفر اول هم می‌توانید وارد کنید"
        )}
      </p>
    </div>
  );
}
