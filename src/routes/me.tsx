import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/account";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, Empty, Field, Skeleton, TextInput } from "@/components/ui";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { faNum, STATUS_FA } from "@/lib/booking/fa";
import { formatWhen } from "@/lib/booking/format";
import { availabilityFn, markReadFn, myBookingsFn, notificationsFn, rescheduleBookingFn, setBookingStatusFn, updateProfileFn } from "@/lib/api";
import { civilInZone, ymd } from "@/lib/booking/time";

export const Route = createFileRoute("/me")({ component: MePage });

type Booking = {
  id: string;
  businessName: string;
  timezone: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  status: string;
  businessId: string;
  serviceId: string;
};

function MePage() {
  const account = useAccount();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; read: boolean; createdAt: string }[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [moveId, setMoveId] = useState("");
  const [slots, setSlots] = useState<{ start: string }[]>([]);

  function load() {
    myBookingsFn().then((res) => {
      if (res.ok) setBookings(res.data);
    });
    notificationsFn().then((res) => {
      if (res.ok) setNotes(res.data);
    });
  }
  useEffect(() => {
    if (!account.user) return;
    load();
    if (account.me) {
      setName(account.me.profile.displayName);
      setPhone(account.me.profile.phone);
    }
  }, [account.user?.id, account.me]);

  if (account.isPending || account.loading) {
    return <Shell><Skeleton className="h-40" /></Shell>;
  }
  if (!account.user) return <RedirectToSignIn />;

  const upcoming = bookings.filter((item) => item.status === "confirmed" || item.status === "pending");
  const past = bookings.filter((item) => item.status !== "confirmed" && item.status !== "pending");

  return (
    <Shell>
      <h1 className="text-3xl font-extrabold">نوبت‌های من</h1>
      <p className="mt-1 text-sm text-muted">{account.me?.unread ? `${account.me.unread} اعلان خوانده‌نشده` : "اعلان داخلی، نه پیامک"}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          {upcoming.length === 0 ? <Empty title="نوبت آینده‌ای نیست" body="از فهرست کسب‌وکارها یک زمان آزاد انتخاب کنید." /> : null}
          {upcoming.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold">{item.serviceName}</h2>
                  <p className="text-sm text-muted">{item.businessName} · {item.staffName}</p>
                  <p className="mt-2 text-sm">{formatWhen(item.startsAt, item.timezone)}</p>
                </div>
                <Badge>{STATUS_FA[item.status] ?? item.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" onClick={async () => {
                  const res = await setBookingStatusFn({ data: { bookingId: item.id, status: "cancelled", reason: "لغو توسط مشتری" } });
                  if (!res.ok) toast.error(res.error);
                  else { toast.success("نوبت لغو شد"); load(); }
                }}>لغو</Button>
                <Button variant="quiet" onClick={async () => {
                  setMoveId(item.id);
                  const c = civilInZone(new Date(item.startsAt), item.timezone);
                  const day = ymd(c.year, c.month, c.day);
                  const res = await availabilityFn({ data: { businessId: item.businessId, serviceId: item.serviceId, day, staffId: "" } });
                  setSlots(res.ok ? res.data.slots : []);
                }}>جابه‌جایی</Button>
              </div>
              {moveId === item.id ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {slots.slice(0, 12).map((slot) => (
                    <button key={slot.start} type="button" className="min-h-11 rounded-xl border border-line text-sm" onClick={async () => {
                      const res = await rescheduleBookingFn({ data: { bookingId: item.id, start: slot.start, staffId: null } });
                      if (!res.ok) toast.error(res.error);
                      else { toast.success("زمان عوض شد"); setMoveId(""); load(); }
                    }}>{formatWhen(slot.start, item.timezone)}</button>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
          {past.length ? <h2 className="mt-2 font-bold">تاریخچه</h2> : null}
          {past.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-semibold">{item.serviceName}</div>
                  <div className="text-sm text-muted">{item.businessName} · {formatWhen(item.startsAt, item.timezone)}</div>
                </div>
                <Badge tone="muted">{STATUS_FA[item.status] ?? item.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
        <div className="grid gap-3">
          <Card>
            <h2 className="font-bold">مشخصات</h2>
            {account.me?.profile.username ? (
              <dl className="mt-3 grid gap-1 text-sm text-muted">
                <div>نام کاربری: {faNum(account.me.profile.username)}</div>
                <div>صفحه: {faNum(account.me.profile.pageName)}</div>
                <div>حوزه: {account.me.profile.activityName}</div>
                <div>{account.me.profile.pageFor === "business" ? "برای کسب‌وکار" : "برای خودم"}</div>
              </dl>
            ) : null}
            <form className="mt-3 grid gap-3" onSubmit={async (event) => {
              event.preventDefault();
              const res = await updateProfileFn({ data: { displayName: name, phone } });
              if (!res.ok) toast.error(res.error);
              else { toast.success("ذخیره شد"); account.reload(); }
            }}>
              <Field label="نام"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Button type="submit">ذخیره</Button>
            </form>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">اعلان‌های داخلی</h2>
              <button type="button" className="text-sm text-jade" onClick={() => markReadFn({ data: {} }).then(() => { load(); account.reload(); })}>خواندم</button>
            </div>
            <ul className="mt-3 grid gap-3">
              {notes.length === 0 ? <li className="text-sm text-muted">اعلانی نیست.</li> : null}
              {notes.map((note) => (
                <li key={note.id} className={note.read ? "text-muted" : ""}>
                  <div className="font-semibold">{note.title}</div>
                  <p className="text-sm leading-6">{note.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
