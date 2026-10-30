import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { JalaliCalendar } from "@/components/jalali-calendar";
import { Badge, Button, Card, Empty, Field, Skeleton, TextInput } from "@/components/ui";
import { STATUS_FA } from "@/lib/booking/fa";
import { formatClock, formatWhen } from "@/lib/booking/format";
import { todayYmd } from "@/lib/booking/time";
import { availabilityFn, businessBookingsFn, createBookingFn, manageBusinessFn, setBookingStatusFn } from "@/lib/api";

export const Route = createFileRoute("/panel/calendar")({ component: CalendarPage });

type Row = {
  id: string;
  serviceName: string;
  staffName: string;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  status: string;
  timezone: string;
  source: string;
};

function CalendarPage() {
  const { businessId } = usePanel();
  const [day, setDay] = useState(todayYmd("Asia/Tehran"));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [manual, setManual] = useState({ serviceId: "", staffId: "", name: "", phone: "", start: "" });
  const [slots, setSlots] = useState<{ start: string; staff: { id: string; name: string }[] }[]>([]);

  function load(id: string, date: string) {
    setLoading(true);
    businessBookingsFn({ data: { businessId: id, day: date } }).then((res) => {
      setRows(res.ok ? res.data : []);
      setLoading(false);
      if (!res.ok) toast.error(res.error);
    });
  }
  useEffect(() => {
    if (!businessId) return;
    manageBusinessFn({ data: { businessId } }).then((res) => {
      if (!res.ok) return;
      setDay(todayYmd(res.data.timezone));
      setServices(res.data.services.filter((item: { active: boolean }) => item.active));
      setStaff(res.data.staff.filter((item: { active: boolean }) => item.active));
      setManual((m) => ({ ...m, serviceId: res.data.services[0]?.id ?? "", staffId: res.data.staff[0]?.id ?? "" }));
    });
  }, [businessId]);
  useEffect(() => {
    if (businessId) load(businessId, day);
  }, [businessId, day]);
  useEffect(() => {
    if (!businessId || !manual.serviceId) return;
    availabilityFn({ data: { businessId, serviceId: manual.serviceId, staffId: manual.staffId, day } }).then((res) => {
      setSlots(res.ok ? res.data.slots : []);
    });
  }, [businessId, manual.serviceId, manual.staffId, day]);

  if (!businessId) return <Empty title="اول کسب‌وکار بسازید" body="از خانه پنل یک صفحه بسازید." />;
  const zone = rows[0]?.timezone ?? "Asia/Tehran";
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <JalaliCalendar value={day} onChange={setDay} />
      <div className="grid gap-3">
        <Card>
          <h2 className="font-bold">نوبت تلفنی یا حضوری</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="خدمت">
              <select className="min-h-11 rounded-xl border border-line bg-card px-3" value={manual.serviceId} onChange={(e) => setManual({ ...manual, serviceId: e.target.value })}>
                {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="متخصص">
              <select className="min-h-11 rounded-xl border border-line bg-card px-3" value={manual.staffId} onChange={(e) => setManual({ ...manual, staffId: e.target.value })}>
                {staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="نام مشتری"><TextInput value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></Field>
            <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {slots.slice(0, 10).map((slot) => (
              <button key={slot.start} type="button" className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${manual.start === slot.start ? "bg-ink text-on-ink" : "border border-line"}`} onClick={() => setManual({ ...manual, start: slot.start })}>
                {formatClock(slot.start, zone)}
              </button>
            ))}
          </div>
          <Button className="mt-3" disabled={!manual.start || manual.name.trim().length < 2} onClick={async () => {
            const res = await createBookingFn({
              data: {
                businessId,
                serviceId: manual.serviceId,
                staffId: manual.staffId,
                start: manual.start,
                note: "",
                manual: true,
                customerName: manual.name,
                customerPhone: manual.phone,
                idempotencyKey: `desk-${crypto.randomUUID()}`,
              },
            });
            if (!res.ok) toast.error(res.error);
            else { toast.success("نوبت دستی ثبت شد"); setManual({ ...manual, name: "", start: "" }); load(businessId, day); }
          }}>ثبت نوبت</Button>
        </Card>
        {loading ? <Skeleton className="h-24" /> : null}
        {!loading && rows.length === 0 ? <Empty title="این روز خالی است" body="نوبت آنلاین یا دستی این‌جا دیده می‌شود." /> : null}
        {rows.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold">{formatWhen(row.startsAt, row.timezone)} · {row.serviceName}</div>
                <p className="text-sm text-muted">{row.staffName} · {row.customerName} {row.customerPhone}</p>
              </div>
              <Badge tone={row.status === "cancelled" ? "danger" : "jade"}>{STATUS_FA[row.status] ?? row.status}</Badge>
            </div>
            {row.status === "confirmed" || row.status === "pending" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => change(row.id, "completed")}>انجام شد</Button>
                <Button variant="quiet" onClick={() => change(row.id, "no_show")}>عدم مراجعه</Button>
                <Button variant="danger" onClick={() => change(row.id, "cancelled")}>لغو</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );

  async function change(bookingId: string, status: string) {
    const res = await setBookingStatusFn({ data: { bookingId, status, reason: "از پنل کسب‌وکار" } });
    if (!res.ok) toast.error(res.error);
    else load(businessId, day);
  }
}
