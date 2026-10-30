import { createFileRoute } from "@tanstack/react-router";
import { Link2, Store, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Shell } from "@/components/shell";
import { Button, Card, ErrorNote, Field, Stepper } from "@/components/ui";
import { OtpField } from "@/components/otp-field";
import { PhoneInput } from "@/components/phone-input";
import { isIranMobile } from "@/lib/iran-phone";
import { enDigits, faNum } from "@/lib/booking/fa";
import { adoptSession } from "@/lib/session";
import { categoriesFn, sendPhoneCodeFn, startAccountFn } from "@/lib/api";

export const Route = createFileRoute("/start")({
  component: StartPage,
});

const STEPS = [
  { title: "حوزه فعالیت", hint: "حوزه‌ای را انتخاب کن که بیشتر به کارت می‌خورد." },
  { title: "این صفحه برای کیست", hint: "بگو این صفحه برای خودت است یا برای کسب‌وکارت." },
  { title: "اسم صفحه", hint: "این اسم را مشتری بالای صفحهٔ تو می‌بیند." },
  { title: "نام کاربری", hint: "فقط نام را بنویس. دامنهٔ سایت ثابت است و عوض نمی‌شود." },
  { title: "شماره موبایل", hint: "کد تأیید برای همین شماره ساخته می‌شود. پیامک واقعی فرستاده نمی‌شود." },
  { title: "کد تأیید", hint: "کدی که همین‌جا نشان داده می‌شود را وارد کن تا حساب ساخته شود." },
];

function StartPage() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [pageFor, setPageFor] = useState<"self" | "business" | "">("");
  const [pageName, setPageName] = useState("");
  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [shownCode, setShownCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    categoriesFn().then((res) => {
      if (res.ok) setCategories(res.data);
    });
    setDomain(window.location.hostname);
  }, []);

  function back() {
    setError("");
    setStep((n) => Math.max(0, n - 1));
  }

  function pickCategory(id: string) {
    setError("");
    setCategoryId(id);
    setStep(1);
  }

  function pickFor(value: "self" | "business") {
    setError("");
    setPageFor(value);
    setStep(2);
  }

  function next() {
    setError("");
    if (step === 0 && !categoryId) return setError("حوزه فعالیت را انتخاب کنید");
    if (step === 1 && !pageFor) return setError("یکی را انتخاب کنید");
    if (step === 2 && pageName.trim().length < 2) return setError("اسم صفحه را بنویسید");
    if (step === 3 && !/^[\p{L}\p{N}_]{3,24}$/u.test(username.trim())) {
      return setError("نام کاربری باید ۳ تا ۲۴ حرف، عدد یا _ باشد");
    }
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  }

  function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setPending(true);
    void (async () => {
      const res = await sendPhoneCodeFn({ data: { phone, purpose: "signup" } });
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setShownCode(res.data.code);
      setCode("");
      setStep(5);
    })();
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await startAccountFn({
      data: { categoryId, pageFor, pageName: pageName.trim(), username: username.trim(), phone, code: code.trim() },
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await adoptSession(res.data.token);
    window.location.assign("/panel");
  }

  return (
    <Shell>
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <Stepper
          className="w-full"
          current={step}
          steps={[
            { label: "حوزه" },
            { label: "برای کی" },
            { label: "اسم" },
            { label: "کاربری" },
            { label: "موبایل" },
            { label: "کد" },
          ]}
        />
        <div className="grid gap-3">
          <h1 className="text-3xl font-extrabold">{STEPS[step].title}</h1>
          <p className="text-sm leading-7 text-muted">{STEPS[step].hint}</p>
          <Card>
            {step === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={categoryId === cat.id ? "min-h-11 rounded-xl bg-jade px-3 text-sm font-semibold text-on-jade" : "min-h-11 rounded-xl border border-line bg-card px-3 text-sm"}
                    onClick={() => pickCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            ) : null}
            {step === 1 ? (
              <div className="grid gap-3">
                <Choice on={pageFor === "self"} onClick={() => pickFor("self")} title="برای خودم" text="صفحه با اسم خودتان ساخته می‌شود." />
                <Choice on={pageFor === "business"} onClick={() => pickFor("business")} title="برای کسب‌وکارم" text="صفحه با اسم کسب‌وکار ساخته می‌شود." />
              </div>
            ) : null}
            {step === 2 ? (
              <Field label={pageFor === "business" ? "اسم کسب‌وکار" : "اسم شما"}>
                <FieldBox icon={pageFor === "business" ? <Store className="size-4" /> : <UserRound className="size-4" />}>
                  <input
                    value={faNum(pageName)}
                    onChange={(e) => setPageName(enDigits(e.target.value))}
                    minLength={2}
                    autoComplete="organization"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </FieldBox>
              </Field>
            ) : null}
            {step === 3 ? (
              <Field label="نام کاربری">
                <div dir="ltr" className="flex min-h-11 overflow-hidden rounded-xl border border-line bg-card focus-within:border-jade">
                  <span className="flex shrink-0 items-center gap-1.5 border-e border-line bg-paper-deep px-3 text-sm text-muted">
                    <Link2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="max-w-36 truncate">{faNum(domain || "…")}/</span>
                  </span>
                  <input
                    value={faNum(username)}
                    onChange={(e) => setUsername(enDigits(e.target.value))}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-label="نام کاربری"
                    placeholder="username"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  />
                </div>
              </Field>
            ) : null}
            {step === 4 ? (
              <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); requestCode(); }}>
                <Field label="شماره موبایل">
                  <PhoneInput value={phone} onChange={(digits) => setPhone(digits)} />
                </Field>
                {error ? <ErrorNote>{error}</ErrorNote> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="quiet" onClick={back}>بازگشت</Button>
                  <Button type="submit" variant="signup" disabled={pending || !isIranMobile(phone)}>{pending ? "در حال ارسال" : "دریافت کد"}</Button>
                </div>
              </form>
            ) : null}
            {step === 5 ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void finish(event);
                }}
              >
                {shownCode ? (
                  <p className="rounded-xl bg-paper-deep px-3 py-2 text-sm leading-6">
                    پیامک وصل نیست. کد تأیید: <span className="font-bold" dir="ltr">{faNum(shownCode)}</span>
                  </p>
                ) : null}
                <Field label="کد تأیید">
                  <OtpField value={code} onChange={setCode} />
                </Field>
                {error ? <ErrorNote>{error}</ErrorNote> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="quiet" onClick={back}>بازگشت</Button>
                  <Button type="submit" variant="signup" disabled={pending || code.trim().length < 6}>{pending ? "در حال ساخت" : "ساخت حساب"}</Button>
                </div>
              </form>
            ) : null}
            {step > 0 && step < 4 ? (
              <div className="mt-4 grid gap-3">
                {error ? <ErrorNote>{error}</ErrorNote> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="quiet" onClick={back}>بازگشت</Button>
                  {step >= 2 ? <Button type="button" variant="signup" onClick={next}>ادامه</Button> : null}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function FieldBox({ icon, ltr = false, children }: { icon: ReactNode; ltr?: boolean; children: ReactNode }) {
  return (
    <div dir={ltr ? "ltr" : undefined} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-jade">
      <span className="shrink-0 text-muted" aria-hidden="true">{icon}</span>
      {children}
    </div>
  );
}

function Choice({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick} className={on ? "rounded-xl bg-jade px-4 py-4 text-start text-on-jade" : "rounded-xl border border-line px-4 py-4 text-start"}>
      <div className="font-bold">{title}</div>
      <p className={on ? "mt-1 text-sm" : "mt-1 text-sm text-muted"}>{text}</p>
    </button>
  );
}
