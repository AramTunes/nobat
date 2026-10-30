import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarPlus, ChevronLeft, Headset, Link2, PenLine, QrCode, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { Button, Card, Field, Skeleton, TextInput } from "@/components/ui";
import { DualSpark } from "@/components/sparkline";
import { WeekBoard } from "@/components/week-board";
import { categoriesFn, createBusinessFn, createDemoFn, dashboardFn, manageBusinessFn } from "@/lib/api";
import { faNum, toman } from "@/lib/booking/fa";

export const Route = createFileRoute("/panel/")({ component: PanelHome });

function tehranMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: "Asia/Tehran",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function greeting(now = new Date()) {
  const hour = Math.floor(tehranMinutes(now) / 60);
  if (hour >= 5 && hour < 12) return "صبح بخیر";
  if (hour >= 12 && hour < 15) return "ظهر بخیر";
  if (hour >= 15 && hour < 19) return "عصر بخیر";
  return "شب بخیر";
}

function firstName(full: string) {
  const name = full.trim().split(/\s+/)[0];
  return name || "کاربر";
}

const zeros = Array.from({ length: 30 }, () => 0);
const emptySeries = { views: zeros, visitors: zeros, sales: zeros, revenue: zeros };
const emptyStats = {
  views: 0, visitors: 0, clicks: 0,
  booked: 0, cancelled: 0, completed: 0, sales: 0, revenueToman: 0,
  prevViews: 0, prevRevenueToman: 0,
};

type MonthStats = typeof emptyStats & { series: typeof emptySeries };

function rate(part: number, whole: number) {
  if (whole <= 0) return "۰٪";
  return `${faNum(Math.round((part / whole) * 100))}٪`;
}

function monthChange(current: number, previous: number) {
  if (current === previous) return { text: "بدون تغییر نسبت به ماه قبل", tone: "text-muted" };
  if (previous <= 0) return { text: "۱۰۰٪ پیشرفت نسبت به ماه قبل", tone: "text-jade" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "بدون تغییر نسبت به ماه قبل", tone: "text-muted" };
  if (pct > 0) return { text: `${faNum(pct)}٪ پیشرفت نسبت به ماه قبل`, tone: "text-jade" };
  return { text: `${faNum(Math.abs(pct))}٪ پسرفت نسبت به ماه قبل`, tone: "text-danger" };
}

type Followup = { id: string; text: string; to: "/panel/services" | "/panel/staff" | "/panel/settings" };

function followups(data: {
  services?: { active?: boolean }[];
  staff?: { active?: boolean; weekly?: unknown[] }[];
  phone?: string;
  subscription?: { endsAt?: string; status?: string };
  smsCredit?: number;
}, personal: boolean): Followup[] {
  const items: Followup[] = [];
  const services = (data.services ?? []).filter((item) => item.active !== false);
  const ready = (data.staff ?? []).filter((item) => item.active !== false && (item.weekly?.length ?? 0) > 0);
  if (services.length === 0 || ready.length === 0 || !String(data.phone ?? "").trim()) {
    const to = services.length === 0 ? "/panel/services" : ready.length === 0 ? "/panel/staff" : "/panel/settings";
    const kind = personal ? "صفحه" : "کسب‌وکار";
    items.push({ id: "setup", text: `راه‌اندازی ${kind} هنوز تمام نشده. بیا تمامش کن.`, to });
  }
  if (data.subscription?.endsAt) {
    const left = new Date(data.subscription.endsAt).getTime() - Date.now();
    if (Number.isFinite(left) && left < 7 * 24 * 60 * 60 * 1000) {
      items.push({ id: "plan", text: "اشتراکت دارد تمام می‌شود. بیا از صفحهٔ تنظیمات تمدیدش کن.", to: "/panel/settings" });
    }
  }
  if (typeof data.smsCredit === "number" && data.smsCredit < 20) {
    items.push({ id: "sms", text: "اعتبار پیامک‌ها دارد تمام می‌شود. بیا اعتبارش را افزایش بده.", to: "/panel/settings" });
  }
  return items;
}

function PanelHome() {
  const { businessId, memberships, displayName, pageFor, pageName } = usePanel();
  const current = memberships.find((item) => item.businessId === businessId);
  const personalPage = pageFor === "self" && current?.name === pageName;
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: "", city: "", phone: "", categoryId: "cat-beauty" });
  const [qrOpen, setQrOpen] = useState(false);
  const [follow, setFollow] = useState<Followup[] | null>(null);
  const [schedule, setSchedule] = useState<{ timezone: string; weekly: { weekday: number; startMin: number; endMin: number }[] } | null>(null);
  const [stats, setStats] = useState<MonthStats | null>(null);

  useEffect(() => {
    categoriesFn().then((res) => {
      if (res.ok) setCategories(res.data);
    });
  }, []);
  useEffect(() => {
    if (!businessId) return;
    let live = true;
    setFollow(null);
    manageBusinessFn({ data: { businessId } }).then((res) => {
      if (!live) return;
      setFollow(res.ok ? followups(res.data, personalPage) : []);
      if (!res.ok) return;
      const weekly = (res.data.staff ?? []).flatMap((person: { weekly?: { weekday: number; startMin: number; endMin: number }[] }) => person.weekly ?? []);
      setSchedule({ timezone: res.data.timezone || "Asia/Tehran", weekly });
    });
    return () => {
      live = false;
    };
  }, [businessId, personalPage]);
  useEffect(() => {
    if (!businessId) return;
    let live = true;
    dashboardFn({ data: { businessId } }).then((res) => {
      if (!live || !res.ok) return;
      const next = res.data.stats ?? emptyStats;
      setStats({ ...next, series: res.data.series ?? emptySeries });
    });
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!businessId) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">کسب‌وکار تازه</h2>
          <form className="mt-4 grid gap-3" onSubmit={async (event) => {
            event.preventDefault();
            const res = await createBusinessFn({ data: { ...form, timezone: "Asia/Tehran" } });
            if (!res.ok) { toast.error(res.error); return; }
            localStorage.setItem("nobatak.business", res.data.businessId);
            toast.success("ساخته شد");
            window.location.assign("/panel/services");
          }}>
            <Field label="نام"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="شهر"><TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="دسته">
              <select className="min-h-11 rounded-xl border border-line bg-card px-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </Field>
            <Button type="submit">ساخت کسب‌وکار</Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">نمونه قابل حذف</h2>
          <p className="mt-2 text-sm leading-6 text-muted">یک آرایشگاه با خدمت، همکار و ساعت کاری می‌سازد تا رزرو را امتحان کنید. برچسب نمونه روی صفحه عمومی می‌ماند.</p>
          <Button className="mt-4" variant="quiet" onClick={async () => {
            const res = await createDemoFn();
            if (!res.ok) { toast.error(res.error); return; }
            localStorage.setItem("nobatak.business", res.data.businessId);
            window.location.assign("/panel");
          }}>ساخت نمونه</Button>
        </Card>
      </div>
    );
  }
  const personal = personalPage;
  const summary = personal ? "صفحه شما" : current?.name;
  const pageUrl = typeof window !== "undefined" && current?.slug ? `${window.location.origin}/b/${current.slug}` : "";
  const shortcuts = [
    { label: "ثبت نوبت", icon: CalendarPlus, to: "/panel/calendar" as const },
    { label: "مشتریان", icon: Users, to: "/panel/customers" as const },
    { label: "گزارشات", icon: BarChart3, to: "/panel/reports" as const },
    { label: "ویرایش صفحه", icon: PenLine, to: "/panel/settings" as const },
  ];
  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">{greeting()} {firstName(displayName)}</h1>
          <p className="mt-1 text-sm text-muted">خلاصه امروز {summary}</p>
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-card"
          aria-label="کد صفحه کسب‌وکار"
          onClick={() => setQrOpen(true)}
        >
          <QrCode className="size-5" />
        </button>
      </div>
      <Card>
        <h2 className="font-extrabold">پیگیری</h2>
        {follow === null ? <Skeleton className="mt-3 h-12" /> : null}
        {follow && follow.length === 0 ? <p className="mt-2 text-sm text-muted">موردی برای پیگیری نیست.</p> : null}
        {follow && follow.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {follow.map((item) => (
              <li key={item.id}>
                <Link to={item.to} className="block rounded-xl bg-paper px-3 py-3 text-sm leading-6">{item.text}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {shortcuts.map((item) => (
          <Link key={item.label} to={item.to} className="flex min-h-24 flex-col justify-between rounded-card border border-line bg-card p-4">
            <item.icon className="size-5 text-jade" aria-hidden="true" />
            <span className="font-bold">{item.label}</span>
          </Link>
        ))}
        <button type="button" className="flex min-h-24 flex-col justify-between rounded-card border border-line bg-card p-4 text-start" onClick={() => setQrOpen(true)}>
          <Link2 className="size-5 text-jade" aria-hidden="true" />
          <span className="font-bold">لینک من</span>
        </button>
        <Link to="/panel/settings" className="flex min-h-24 flex-col justify-between rounded-card border border-line bg-card p-4">
          <Settings className="size-5 text-jade" aria-hidden="true" />
          <span className="font-bold">تنظیمات</span>
        </Link>
      </div>
      {businessId && schedule ? <WeekBoard businessId={businessId} timezone={schedule.timezone} weekly={schedule.weekly} /> : null}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-extrabold">عملکرد یکماه اخیر</h2>
          <Link to="/panel/reports" className="text-sm font-semibold text-jade">مشاهده بیشتر</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                ["بازدید", faNum(stats?.views ?? 0)],
                ["بازدیدکننده", faNum(stats?.visitors ?? 0)],
                ["کلیک", faNum(stats?.clicks ?? 0)],
                ["درصد تبدیل", rate(stats?.booked ?? 0, stats?.visitors ?? 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-lg font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-jade" />بازدید</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-copper" />بازدیدکننده</span>
            </div>
            <DualSpark primary={stats?.series.views ?? zeros} secondary={stats?.series.visitors ?? zeros} primaryColor="var(--color-jade)" secondaryColor="var(--color-copper)" />
            <p className={`mt-2 text-xs font-semibold ${monthChange(stats?.views ?? 0, stats?.prevViews ?? 0).tone}`}>{monthChange(stats?.views ?? 0, stats?.prevViews ?? 0).text}</p>
          </Card>
          <Card>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                ["نوبت ثبت‌شده", faNum(stats?.booked ?? 0)],
                ["نوبت لغوشده", faNum(stats?.cancelled ?? 0)],
                ["نوبت تکمیل‌شده", faNum(stats?.completed ?? 0)],
                ["فروش", faNum(stats?.sales ?? 0)],
                ["درآمد", toman(stats?.revenueToman ?? 0)],
                ["درصد لغو", rate(stats?.cancelled ?? 0, (stats?.booked ?? 0) + (stats?.cancelled ?? 0))],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-lg font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-jade" />فروش</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-copper" />درآمد</span>
            </div>
            <DualSpark primary={stats?.series.sales ?? zeros} secondary={stats?.series.revenue ?? zeros} primaryColor="var(--color-jade)" secondaryColor="var(--color-copper)" />
            <p className={`mt-2 text-xs font-semibold ${monthChange(stats?.revenueToman ?? 0, stats?.prevRevenueToman ?? 0).tone}`}>{monthChange(stats?.revenueToman ?? 0, stats?.prevRevenueToman ?? 0).text}</p>
          </Card>
        </div>
      </section>
      <Link to="/support" className="flex items-center justify-between gap-3 rounded-card border border-line bg-card p-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-jade-soft text-jade">
            <Headset className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-extrabold">راهنما و پشتیبانی</span>
            <span className="mt-0.5 block text-sm text-muted">سوالی داری؟ با ما در ارتباط باش</span>
          </span>
        </span>
        <ChevronLeft className="size-5 shrink-0 text-muted" aria-hidden="true" />
      </Link>
      {qrOpen && current ? <QrDialog name={current.name} slug={current.slug} url={pageUrl} onClose={() => setQrOpen(false)} /> : null}
    </div>
  );
}

function QrDialog({ name, slug, url, onClose }: { name: string; slug: string; url: string; onClose: () => void }) {
  const [src, setSrc] = useState("");
  const link = url || `/b/${slug}`;
  useEffect(() => {
    let live = true;
    const target = url || `${window.location.origin}/b/${slug}`;
    import("qrcode").then((QR) => QR.toDataURL(target, { width: 320, margin: 1, color: { dark: "#121212", light: "#ffffff" } })).then((next) => {
      if (live) setSrc(next);
    });
    return () => {
      live = false;
    };
  }, [slug, url]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={onClose} />
      <div className="relative z-10 grid w-full max-w-sm justify-items-center gap-3 rounded-card border border-line bg-card p-5 text-center shadow-xl">
        <h2 className="font-extrabold">{name}</h2>
        {src ? <img src={src} alt="" className="size-56 rounded-xl bg-white p-2" /> : <Skeleton className="size-56" />}
        <p className="w-full truncate text-sm text-muted" dir="ltr">{link}</p>
        <Button
          type="button"
          variant="signup"
          onClick={() => {
            const target = url || `${window.location.origin}/b/${slug}`;
            void navigator.clipboard.writeText(target).then(() => toast.success("لینک کپی شد")).catch(() => toast.error("کپی نشد"));
          }}
        >
          کپی لینک
        </Button>
      </div>
    </div>
  );
}