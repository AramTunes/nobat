import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { Badge, Button, Card, Empty, Field, Skeleton, TextInput } from "@/components/ui";
import { WEEKDAYS_FA, clockLabel, enDigits } from "@/lib/booking/fa";
import { manageBusinessFn, saveScheduleFn, saveStaffFn } from "@/lib/api";

export const Route = createFileRoute("/panel/staff")({ component: StaffPage });

type Service = { id: string; name: string; active: boolean };
type Staff = {
  id: string;
  name: string;
  title: string;
  active: boolean;
  serviceIds: string[];
  weekly: { weekday: number; startMin: number; endMin: number }[];
  breaks: { weekday: number; startMin: number; endMin: number }[];
};
type Day = {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
};

function pad(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function toMin(value: string) {
  const [h, m] = enDigits(value).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}
function daysOf(person: Staff | null): Day[] {
  return WEEKDAYS_FA.map((_, weekday) => {
    const window = person?.weekly.find((item) => item.weekday === weekday);
    const rest = person?.breaks.find((item) => item.weekday === weekday);
    const enabled = person ? Boolean(window) : weekday !== 5;
    return {
      weekday,
      enabled,
      start: pad(window?.startMin ?? 540),
      end: pad(window?.endMin ?? 1080),
      breakStart: rest ? pad(rest.startMin) : "",
      breakEnd: rest ? pad(rest.endMin) : "",
    };
  });
}

function StaffPage() {
  const { businessId } = usePanel();
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [active, setActive] = useState(true);
  const [id, setId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [days, setDays] = useState<Day[]>(daysOf(null));
  const [saving, setSaving] = useState(false);
  const primed = useRef(false);

  function load(biz: string) {
    setLoading(true);
    manageBusinessFn({ data: { businessId: biz } }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      setServices(res.data.services);
      setStaff(res.data.staff);
      setLoading(false);
    });
  }
  useEffect(() => {
    if (businessId) load(businessId);
  }, [businessId]);
  useEffect(() => {
    if (primed.current || id || services.length === 0) return;
    primed.current = true;
    setServiceIds(services.filter((item) => item.active).map((item) => item.id));
  }, [services, id]);

  const selected = useMemo(() => staff.find((item) => item.id === id) ?? null, [staff, id]);

  function edit(person: Staff) {
    setId(person.id);
    setName(person.name);
    setTitle(person.title);
    setActive(person.active);
    setServiceIds(person.serviceIds);
    setDays(daysOf(person));
  }
  function reset() {
    setId("");
    setName("");
    setTitle("");
    setActive(true);
    setServiceIds(services.filter((item) => item.active).map((item) => item.id));
    setDays(daysOf(null));
  }

  if (!businessId) return <Empty title="اول کسب‌وکار بسازید" body="همکاران بعد از ساخت صفحه کسب‌وکار اضافه می‌شوند." />;
  if (loading) return <Skeleton className="h-48" />;
  if (services.length === 0) {
    return <Empty title="اول خدمت بسازید" body="هر همکار باید حداقل به یک خدمت وصل شود." action={<Link to="/panel/services" className="inline-flex min-h-11 items-center rounded-xl bg-jade px-4 font-semibold text-on-jade">رفتن به خدمات</Link>} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="grid content-start gap-2">
        <Button type="button" variant="quiet" onClick={reset}>همکار تازه</Button>
        {staff.length === 0 ? <p className="text-sm text-muted">هنوز همکاری ثبت نشده.</p> : null}
        {staff.map((person) => (
          <button key={person.id} type="button" onClick={() => edit(person)} className={`rounded-xl border p-3 text-start ${person.id === id ? "border-jade bg-jade-soft" : "border-line bg-card"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{person.name}</span>
              {!person.active ? <Badge tone="muted">غیرفعال</Badge> : null}
            </div>
            <p className="text-sm text-muted">{person.title || "بدون عنوان"}</p>
          </button>
        ))}
      </div>
      <Card>
        <h2 className="text-lg font-bold">{id ? "ویرایش همکار" : "همکار تازه"}</h2>
        <p className="mt-1 text-sm text-muted">ساعت کاری جدید برای همکار تازه، شنبه تا پنجشنبه ۹ تا ۱۸ است. جمعه تعطیل است. استراحت را خالی بگذارید اگر ندارید.</p>
        <form
          className="mt-4 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!serviceIds.length) {
              toast.error("حداقل یک خدمت را انتخاب کنید");
              return;
            }
            setSaving(true);
            const saved = await saveStaffFn({
              data: { businessId, ...(id ? { id } : {}), name, title, active, serviceIds },
            });
            if (!saved.ok) {
              setSaving(false);
              toast.error(saved.error);
              return;
            }
            const schedule = await saveScheduleFn({
              data: {
                businessId,
                staffId: saved.data.staffId,
                days: days.map((day) => ({
                  weekday: day.weekday,
                  enabled: day.enabled,
                  startMin: toMin(day.start),
                  endMin: toMin(day.end),
                  breakStart: day.breakStart ? toMin(day.breakStart) : "",
                  breakEnd: day.breakEnd ? toMin(day.breakEnd) : "",
                })),
              },
            });
            setSaving(false);
            if (!schedule.ok) {
              toast.error(schedule.error);
              setId(saved.data.staffId);
              load(businessId);
              return;
            }
            toast.success("همکار و برنامه ذخیره شد");
            setId(saved.data.staffId);
            load(businessId);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام"><TextInput value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
            <Field label="عنوان"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً استایلیست" /></Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">خدمات</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => {
                const on = serviceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`min-h-11 rounded-full px-4 text-sm ${on ? "bg-jade text-on-jade" : "border border-line"}`}
                    onClick={() => setServiceIds(on ? serviceIds.filter((item) => item !== service.id) : [...serviceIds, service.id])}
                  >
                    {service.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            برای رزرو در دسترس باشد
          </label>
          <div className="grid gap-2">
            {days.map((day, index) => (
              <div key={day.weekday} className="grid items-center gap-2 rounded-xl bg-paper px-3 py-2 sm:grid-cols-[7rem_4.5rem_1fr_1fr]">
                <span className="text-sm font-medium">{WEEKDAYS_FA[day.weekday]}</span>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => setDays(days.map((item, i) => (i === index ? { ...item, enabled: e.target.checked } : item)))}
                  />
                  باز
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  شروع تا پایان
                  <span className="flex gap-1">
                    <TextInput dir="ltr" className="px-2 text-left" disabled={!day.enabled} value={day.start} onChange={(e) => setDays(days.map((item, i) => (i === index ? { ...item, start: e.target.value } : item)))} />
                    <TextInput dir="ltr" className="px-2 text-left" disabled={!day.enabled} value={day.end} onChange={(e) => setDays(days.map((item, i) => (i === index ? { ...item, end: e.target.value } : item)))} />
                  </span>
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  استراحت
                  <span className="flex gap-1">
                    <TextInput dir="ltr" className="px-2 text-left" disabled={!day.enabled} value={day.breakStart} onChange={(e) => setDays(days.map((item, i) => (i === index ? { ...item, breakStart: e.target.value } : item)))} />
                    <TextInput dir="ltr" className="px-2 text-left" disabled={!day.enabled} value={day.breakEnd} onChange={(e) => setDays(days.map((item, i) => (i === index ? { ...item, breakEnd: e.target.value } : item)))} />
                  </span>
                </label>
              </div>
            ))}
          </div>
          {selected ? (
            <p className="text-sm text-muted">
              برنامه فعلی: {selected.weekly.map((item) => `${WEEKDAYS_FA[item.weekday]} ${clockLabel(item.startMin)}–${clockLabel(item.endMin)}`).join("، ") || "بدون ساعت"}
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره" : "ذخیره همکار"}</Button>
        </form>
      </Card>
    </div>
  );
}
