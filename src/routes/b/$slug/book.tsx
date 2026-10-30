import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { JalaliCalendar } from "@/components/jalali-calendar";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, Empty, ErrorNote, Field, Skeleton, TextInput } from "@/components/ui";
import { useCurrentUserState } from "@/lib/session";
import { minutesLabel, toman } from "@/lib/booking/fa";
import { formatClock, formatDay } from "@/lib/booking/format";
import { addDaysYmd, todayYmd } from "@/lib/booking/time";
import { availabilityFn, createBookingFn, publicBusinessFn } from "@/lib/api";

export const Route = createFileRoute("/b/$slug/book")({ component: BookPage });

type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceToman: number;
};
type Biz = {
  id: string;
  name: string;
  timezone: string;
  allowAnyStaff: boolean;
  isDemo: boolean;
  minLeadMinutes: number;
  maxHorizonDays: number;
  services: Service[];
  staff: { id: string; name: string; title: string; serviceIds: string[] }[];
};

function idempotency() {
  const key = `web-${crypto.randomUUID()}`;
  return key;
}

function BookPage() {
  const { slug } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [biz, setBiz] = useState<Biz | null>(null);
  const [error, setError] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<{ start: string; staff: { id: string; name: string }[] }[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [start, setStart] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    let live = true;
    publicBusinessFn({ data: { slug } }).then((res) => {
      if (!live) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBiz(res.data);
      setServiceId(res.data.services[0]?.id ?? "");
      setDay(todayYmd(res.data.timezone));
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const service = biz?.services.find((item) => item.id === serviceId);
  const staffChoices = useMemo(
    () => biz?.staff.filter((person) => person.serviceIds.includes(serviceId)) ?? [],
    [biz, serviceId],
  );

  useEffect(() => {
    if (!biz || !serviceId || !day) return;
    let live = true;
    setSlotLoading(true);
    setStart("");
    availabilityFn({ data: { businessId: biz.id, serviceId, staffId: staffId ?? "", day } }).then((res) => {
      if (!live) return;
      setSlots(res.ok ? res.data.slots : []);
      if (!res.ok) setError(res.error);
      setSlotLoading(false);
    });
    return () => {
      live = false;
    };
  }, [biz, serviceId, staffId, day]);

  async function confirm() {
    if (!biz || !start) return;
    setPending(true);
    const res = await createBookingFn({
      data: { businessId: biz.id, serviceId, staffId, start, note, idempotencyKey: idempotency() },
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDone(res.data.id);
    toast.success("نوبت ثبت شد");
  }

  if (error && !biz) {
    return (
      <Shell>
        <Empty title="رزرو ممکن نیست" body={error} />
      </Shell>
    );
  }
  if (!biz) {
    return (
      <Shell>
        <Skeleton className="h-64" />
      </Shell>
    );
  }
  const min = todayYmd(biz.timezone);
  const max = addDaysYmd(min, biz.maxHorizonDays, biz.timezone);

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">رزرو در {biz.name}</h1>
          {biz.isDemo ? <Badge tone="copper">تمرین با داده نمونه</Badge> : null}
        </div>
        <Link to="/b/$slug" params={{ slug }} className="text-sm font-semibold text-jade">بازگشت به صفحه</Link>
      </div>
      {done ? (
        <Card>
          <h2 className="text-xl font-bold">نوبت ثبت شد</h2>
          <p className="mt-2 text-sm leading-6 text-muted">جزئیات در «نوبت‌های من» است. پیامک ارسال نشده؛ فقط اعلان داخلی ثبت شد.</p>
          <Link to="/me" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-jade px-4 font-semibold text-on-jade">مشاهده نوبت‌ها</Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            <Card>
              <h2 className="font-bold">۱. خدمت</h2>
              <div className="mt-3 grid gap-2">
                {biz.services.map((item) => (
                  <button key={item.id} type="button" onClick={() => setServiceId(item.id)} className={`rounded-xl border px-3 py-3 text-start ${item.id === serviceId ? "border-jade bg-jade-soft" : "border-line"}`}>
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{item.name}</span>
                      <span className="tabular-nums">{toman(item.priceToman)}</span>
                    </div>
                    <div className="text-sm text-muted">{minutesLabel(item.durationMinutes)}{item.bufferMinutes ? ` + ${minutesLabel(item.bufferMinutes)} آماده‌سازی` : ""}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-bold">۲. متخصص</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {biz.allowAnyStaff ? (
                  <button type="button" className={`min-h-11 rounded-full px-4 text-sm ${staffId === null ? "bg-jade text-on-jade" : "border border-line"}`} onClick={() => setStaffId(null)}>اولین متخصص آزاد</button>
                ) : null}
                {staffChoices.map((person) => (
                  <button key={person.id} type="button" className={`min-h-11 rounded-full px-4 text-sm ${staffId === person.id ? "bg-jade text-on-jade" : "border border-line"}`} onClick={() => setStaffId(person.id)}>
                    {person.name}
                  </button>
                ))}
              </div>
            </Card>
          </div>
          <div className="grid gap-3">
            <JalaliCalendar value={day || min} onChange={setDay} min={min} max={max} />
            <Card>
              <h2 className="font-bold">۳. زمان {day ? formatDay(day) : ""}</h2>
              {slotLoading ? <Skeleton className="mt-3 h-16" /> : null}
              {!slotLoading && slots.length === 0 ? <p className="mt-3 text-sm text-muted">در این روز وقت آزادی نیست.</p> : null}
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button key={slot.start} type="button" onClick={() => setStart(slot.start)} className={`min-h-11 rounded-xl text-sm tabular-nums ${start === slot.start ? "bg-ink text-on-ink" : "border border-line"}`}>
                    {formatClock(slot.start, biz.timezone)}
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <Field label="یادداشت برای کسب‌وکار">
                <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
              {service && start ? (
                <p className="mt-3 text-sm">{service.name}، {formatClock(start, biz.timezone)}، {toman(service.priceToman)}</p>
              ) : null}
              {isPending ? <Skeleton className="mt-3 h-11" /> : null}
              {!isPending && !user ? (
                <div className="mt-3 grid gap-2">
                  <ErrorNote>برای ثبت نوبت وارد شوید.</ErrorNote>
                  <Link to="/auth" search={{ next: `/b/${slug}/book` }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink font-semibold text-on-ink">ورود</Link>
                </div>
              ) : null}
              {user ? (
                <Button className="mt-3 w-full" disabled={!start || pending} onClick={confirm}>
                  {pending ? "در حال ثبت" : "تأیید رزرو"}
                </Button>
              ) : null}
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}
