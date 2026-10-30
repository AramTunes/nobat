import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { OtpField } from "@/components/otp-field";
import { PhoneInput } from "@/components/phone-input";
import { Button, Card, ErrorNote, Field, TextInput } from "@/components/ui";
import { faNum } from "@/lib/booking/fa";
import { isIranMobile, formatIranMobile } from "@/lib/iran-phone";
import { adoptSession } from "@/lib/session";
import { lookupPhoneFn, resetPhonePasswordFn, sendPhoneCodeFn, signInPhoneCodeFn, signInPhoneFn } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const next = typeof search.next === "string" && search.next.startsWith("/") && !search.next.startsWith("//") ? search.next : "/panel";
    return { next };
  },
  component: AuthPage,
});

type Step = "phone" | "password" | "code" | "reset";

function AuthPage() {
  const { next } = Route.useSearch();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [shownCode, setShownCode] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function enter(token: string) {
    await adoptSession(token);
    window.location.assign(next);
  }

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await lookupPhoneFn({ data: { phone } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (!res.data.registered) {
      setError("این شماره ثبت نشده است.");
      setStep("phone");
      return;
    }
    setStep("password");
  }

  async function withPassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await signInPhoneFn({ data: { phone, password } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await enter(res.data.token);
  }

  async function requestCode(purpose: "login" | "reset") {
    setError("");
    setCode("");
    setShownCode("");
    setNextPassword("");
    setConfirm("");
    setPending(true);
    const res = await sendPhoneCodeFn({ data: { phone, purpose } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShownCode(res.data.code);
    setStep(purpose === "reset" ? "reset" : "code");
  }

  async function withCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await signInPhoneCodeFn({ data: { phone, code } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await enter(res.data.token);
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await resetPhonePasswordFn({ data: { phone, code, password: nextPassword, confirm } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await enter(res.data.token);
  }

  return (
    <Shell>
      <div className="mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl font-extrabold">ورود</h1>
        <p className="text-sm leading-6 text-muted">شماره موبایل را بنویسید. اگر حساب داشته باشید، رمز یا کد تأیید خواسته می‌شود.</p>
        <Card>
          {step === "phone" ? (
            <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void lookup(event); }}>
              <Field label="شماره موبایل">
                <PhoneInput value={phone} onChange={(digits) => setPhone(digits)} />
              </Field>
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              {error.includes("ثبت نشده") ? (
                <Link to="/start" className="text-sm font-semibold text-jade">شروع رایگان و ساخت حساب</Link>
              ) : null}
              <Button type="submit" disabled={pending || !isIranMobile(phone)}>{pending ? "در حال بررسی" : "ادامه"}</Button>
            </form>
          ) : null}

          {step === "password" ? (
            <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void withPassword(event); }}>
              <p className="text-sm text-muted" dir="ltr">{faNum(`+98 ${formatIranMobile(phone)}`)}</p>
              <Field label="رمز عبور">
                <TextInput type="password" dir="ltr" className="text-left" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button type="button" className="font-semibold text-jade" onClick={() => requestCode("reset")}>فراموشی رمز عبور</button>
                <button type="button" className="font-semibold text-ink" onClick={() => requestCode("login")}>ورود بدون رمز</button>
              </div>
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <Button type="submit" disabled={pending}>{pending ? "در حال ورود" : "ورود"}</Button>
              <button type="button" className="text-sm text-muted" onClick={() => { setStep("phone"); setError(""); }}>تغییر شماره</button>
            </form>
          ) : null}

          {step === "code" ? (
            <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void withCode(event); }}>
              <CodeNotice code={shownCode} />
              <Field label="کد تأیید">
                <OtpField value={code} onChange={setCode} />
              </Field>
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <Button type="submit" disabled={pending || code.length < 6}>{pending ? "در حال ورود" : "ورود"}</Button>
              <button type="button" className="text-sm text-muted" onClick={() => setStep("password")}>بازگشت</button>
            </form>
          ) : null}

          {step === "reset" ? (
            <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void changePassword(event); }}>
              <CodeNotice code={shownCode} />
              <Field label="کد تأیید">
                <OtpField value={code} onChange={setCode} />
              </Field>
              {code.trim().length >= 6 ? (
                <>
                  <Field label="رمز تازه" hint="حداقل ۸ نویسه">
                    <TextInput type="password" dir="ltr" className="text-left" autoComplete="new-password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} required minLength={8} />
                  </Field>
                  <Field label="تکرار رمز">
                    <TextInput type="password" dir="ltr" className="text-left" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-muted">کد را وارد کنید تا رمز تازه را بنویسید.</p>
              )}
              {error ? <ErrorNote>{error}</ErrorNote> : null}
              <Button type="submit" disabled={pending || code.trim().length < 6}>{pending ? "در حال ذخیره" : "تأیید و ورود"}</Button>
              <button type="button" className="text-sm text-muted" onClick={() => setStep("password")}>بازگشت</button>
            </form>
          ) : null}
        </Card>
      </div>
    </Shell>
  );
}

function CodeNotice({ code }: { code: string }) {
  if (!code) return null;
  return (
    <p className="rounded-xl bg-paper-deep px-3 py-2 text-sm leading-6">
      پیامک وصل نیست. کد تأیید: <span className="font-bold" dir="ltr">{faNum(code)}</span>
    </p>
  );
}
