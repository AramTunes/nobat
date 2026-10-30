import { cn } from "@/lib/cn";
import { enDigits, faNum } from "@/lib/booking/fa";
import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "danger" | "ink" | "signup" }) {
  const styles = {
    primary: "bg-jade text-on-jade hover:bg-jade-deep",
    quiet: "bg-card text-ink border border-line hover:bg-paper",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-on-ink",
    ink: "bg-ink text-on-ink hover:bg-jade-deep",
    signup: "bg-[var(--signup-bg)] text-[var(--signup-fg)] hover:opacity-90",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card border border-line bg-card p-5 shadow-sm", className)}>{children}</section>;
}

export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  className,
}: {
  steps: { label: ReactNode; description?: ReactNode }[];
  current: number;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const horizontal = orientation === "horizontal";
  return (
    <ol className={cn(horizontal ? "relative flex w-full items-start justify-between pb-7" : "flex flex-col gap-5", className)} aria-label="مراحل">
      {horizontal ? (
        <div className="pointer-events-none absolute start-3.5 end-3.5 top-3.5 flex" aria-hidden="true">
          {steps.slice(0, -1).map((_, index) => (
            <span key={index} className={cn("h-px flex-1", index < current ? "bg-jade" : "bg-line")} />
          ))}
        </div>
      ) : null}
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === steps.length - 1;
        const circle = (
          <span
            className={cn(
              "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              done && "bg-jade text-on-jade",
              active && "border-2 border-jade bg-paper text-ink",
              !done && !active && "border border-line bg-paper text-muted",
            )}
          >
            {done ? <Check className="size-3.5" aria-hidden="true" /> : faNum(index + 1)}
          </span>
        );
        const text = (
          <div>
            <p className={cn("text-xs leading-5", active ? "font-semibold text-ink" : done ? "text-ink" : "text-muted")}>{step.label}</p>
            {step.description ? <p className="text-xs text-muted">{step.description}</p> : null}
          </div>
        );
        if (!horizontal) {
          return (
            <li key={index} className="relative flex items-start gap-3" aria-current={active ? "step" : undefined}>
              {!last ? <span className={cn("absolute start-3.5 top-8 h-[calc(100%-0.5rem)] w-px", done ? "bg-jade" : "bg-line")} /> : null}
              {circle}
              {text}
            </li>
          );
        }
        const align = index === 0 ? "items-start text-start" : last ? "items-end text-end" : "items-center text-center";
        return (
          <li key={index} className={cn("relative flex flex-col", align)} aria-current={active ? "step" : undefined}>
            {circle}
            <div
              className={cn(
                "absolute top-full mt-2 w-max max-w-16",
                index === 0 ? "start-0" : last ? "end-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              {text}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Badge({
  tone = "jade",
  children,
}: {
  tone?: "jade" | "copper" | "muted" | "danger";
  children: ReactNode;
}) {
  const styles = {
    jade: "bg-jade-soft text-jade-deep",
    copper: "bg-copper-soft text-copper",
    muted: "bg-paper-deep text-muted",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", styles)}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ value, onChange, type, inputMode, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const numeric = type === "number";
  const controlled = value !== undefined && value !== null;
  return (
    <input
      {...props}
      type={numeric ? "text" : type}
      inputMode={numeric ? "numeric" : inputMode}
      value={controlled ? faNum(String(value)) : value}
      onChange={(event) => {
        const english = enDigits(event.target.value);
        if (english !== event.target.value) event.target.value = english;
        onChange?.(event);
      }}
      className={cn(
        "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none",
        props.className,
      )}
    />
  );
}

export function Area({ value, onChange, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlled = value !== undefined && value !== null;
  return (
    <textarea
      {...props}
      value={controlled ? faNum(String(value)) : value}
      onChange={(event) => {
        const english = enDigits(event.target.value);
        if (english !== event.target.value) event.target.value = english;
        onChange?.(event);
      }}
      className={cn(
        "min-h-24 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none",
        props.className,
      )}
    />
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-line bg-card px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-paper-deep", className)} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{children}</p>;
}
