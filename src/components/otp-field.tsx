import { useRef, useState } from "react";
import { faNum } from "@/lib/booking/fa";
import { cn } from "@/lib/cn";
import { enDigits } from "@/lib/iran-phone";

export function OtpField({
  length = 6,
  value,
  defaultValue = "",
  onChange,
  onComplete,
  disabled,
  size = "md",
  className,
  "aria-label": ariaLabel = "کد تأیید",
}: {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const code = value ?? internal;
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string) {
    const clean = enDigits(next).replace(/\D/g, "").slice(0, length);
    if (value === undefined) setInternal(clean);
    onChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  }

  return (
    <div className={cn("inline-flex", size === "sm" ? "gap-1" : "gap-1.5", className)} dir="ltr" role="group" aria-label={ariaLabel}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={code[index] ? faNum(code[index]) : ""}
          onChange={(e) => {
            const typed = enDigits(e.target.value).replace(/\D/g, "");
            if (typed.length > 1) {
              commit(code.slice(0, index) + typed);
              return;
            }
            commit(code.slice(0, index) + typed + code.slice(index + 1));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !code[index] && index > 0) {
              e.preventDefault();
              commit(code.slice(0, index - 1));
            }
            if (e.key === "ArrowLeft") refs.current[index - 1]?.focus();
            if (e.key === "ArrowRight") refs.current[index + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "shrink-0 rounded-lg border border-line bg-card text-center font-semibold text-ink caret-transparent",
            "focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20",
            "disabled:opacity-50",
            size === "sm" ? "h-10 w-8 text-sm" : "h-11 w-9 text-base",
          )}
        />
      ))}
    </div>
  );
}
