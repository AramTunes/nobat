import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { JalaliCalendar } from "@/components/jalali-calendar";
import { Button, Card, Empty, Field, Area, Select, Skeleton, TextInput } from "@/components/ui";
import { formatDay } from "@/lib/booking/format";
import { todayYmd } from "@/lib/booking/time";
import { addHolidayFn, categoriesFn, deleteBusinessFn, manageBusinessFn, removeHolidayFn, updateBusinessFn } from "@/lib/api";

export const Route = createFileRoute("/panel/settings")({ component: SettingsPage });

type Form = {
  name: string;
  description: string;
  categoryId: string;
  city: string;
  address: string;
  phone: string;
  timezone: string;
  cancelBeforeMinutes: number;
  minLeadMinutes: number;
  maxHorizonDays: number;
  slotStepMinutes: number;
  allowAnyStaff: boolean;
  isDemo: boolean;
  slug: string;
};

function SettingsPage() {
  const { businessId, memberships } = usePanel();
  const role = memberships.find((item) => item.businessId === businessId)?.role;
  const [form, setForm] = useState<Form | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; staffId: string | null; date: string; note: string }[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [day, setDay] = useState(todayYmd("Asia/Tehran"));
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState("");
  const [confirmName, setConfirmName] = useState("");

  function load(id: string) {
    manageBusinessFn({ data: { businessId: id } }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data;
      setForm({
        name: data.name,
        description: data.description,
        categoryId: data.categoryId ?? "",
        city: data.city,
        address: data.address,
        phone: data.phone,
        timezone: data.timezone,
        cancelBeforeMinutes: data.cancelBeforeMinutes,
        minLeadMinutes: data.minLeadMinutes,
        maxHorizonDays: data.maxHorizonDays,
        slotStepMinutes: data.slotStepMinutes,
        allowAnyStaff: data.allowAnyStaff,
        isDemo: data.isDemo,
        slug: data.slug,
      });
      setHolidays(data.holidays);
      setStaff(data.staff);
      setDay(todayYmd(data.timezone));
    });
  }
  useEffect(() => {
    categoriesFn().then((res) => {
      if (res.ok) setCategories(res.data);
    });
  }, []);
  useEffect(() => {
    if (businessId) load(businessId);
  }, [businessId]);

  if (!businessId) return <Empty title="اول کسب‌وکار بسازید" body="تنظیمات بعد از ساخت صفحه در دسترس است." />;
  if (!form) return <Skeleton className="h-64" />;
  const owner = role === "owner";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-bold">مشخصات و سیاست رزرو</h2>
        <p className="mt-1 text-sm text-muted">نشانی عمومی: /b/{form.slug}</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const res = await updateBusinessFn({
              data: {
                businessId,
                ...form,
                categoryId: form.categoryId,
                cancelBeforeMinutes: Number(form.cancelBeforeMinutes),
                minLeadMinutes: Number(form.minLeadMinutes),
                maxHorizonDays: Number(form.maxHorizonDays),
                slotStepMinutes: Number(form.slotStepMinutes),
              },
            });
            if (!res.ok) toast.error(res.error);
            else toast.success("تنظیمات ذخیره شد");
          }}
        >
          <Field label="نام"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="توضیح"><Area value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="دسته">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">بدون دسته</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="شهر"><TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="آدرس"><TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="منطقه زمانی" hint="زمان‌ها در پایگاه داده به وقت جهانی ذخیره می‌شوند.">
            <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              <option value="Asia/Tehran">تهران</option>
              <option value="Asia/Dubai">دبی</option>
              <option value="Europe/Istanbul">استانبول</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="حداقل فاصله تا نوبت (دقیقه)"><TextInput type="number" min={0} value={form.minLeadMinutes} onChange={(e) => setForm({ ...form, minLeadMinutes: Number(e.target.value) })} /></Field>
            <Field label="مهلت لغو (دقیقه قبل)"><TextInput type="number" min={0} value={form.cancelBeforeMinutes} onChange={(e) => setForm({ ...form, cancelBeforeMinutes: Number(e.target.value) })} /></Field>
            <Field label="افق رزرو (روز)"><TextInput type="number" min={1} max={180} value={form.maxHorizonDays} onChange={(e) => setForm({ ...form, maxHorizonDays: Number(e.target.value) })} /></Field>
            <Field label="گام زمان (دقیقه)"><TextInput type="number" min={5} max={60} value={form.slotStepMinutes} onChange={(e) => setForm({ ...form, slotStepMinutes: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowAnyStaff} onChange={(e) => setForm({ ...form, allowAnyStaff: e.target.checked })} />
            مشتری بتواند بدون انتخاب متخصص رزرو کند
          </label>
          {form.isDemo ? <p className="text-sm text-copper">این صفحه داده نمونه است و روی فهرست عمومی برچسب نمونه دارد.</p> : null}
          <Button type="submit">ذخیره تنظیمات</Button>
        </form>
      </Card>
      <div className="grid content-start gap-4">
        <Card>
          <h2 className="text-lg font-bold">تعطیلی</h2>
          <p className="mt-1 text-sm leading-6 text-muted">تعطیلی بدون همکار، کل کسب‌وکار را آن روز می‌بندد. ظرفیت لغوشده آزاد می‌ماند.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <JalaliCalendar value={day} onChange={setDay} />
            <div className="grid content-start gap-3">
              <Field label="برای">
                <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">همه همکاران</option>
                  {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </Select>
              </Field>
              <Field label="یادداشت"><TextInput value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <Button
                type="button"
                onClick={async () => {
                  const res = await addHolidayFn({ data: { businessId, date: day, staffId, note } });
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("تعطیلی ثبت شد");
                    setNote("");
                    load(businessId);
                  }
                }}
              >
                ثبت تعطیلی
              </Button>
            </div>
          </div>
          <ul className="mt-4 grid gap-2">
            {holidays.length === 0 ? <li className="text-sm text-muted">تعطیلی ثبت نشده.</li> : null}
            {holidays.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                <span>{formatDay(item.date)} · {item.staffId ? staff.find((person) => person.id === item.staffId)?.name ?? "همکار" : "همه"} {item.note}</span>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={async () => {
                    const res = await removeHolidayFn({ data: { businessId, holidayId: item.id } });
                    if (!res.ok) toast.error(res.error);
                    else load(businessId);
                  }}
                >
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        </Card>
        {owner ? (
          <Card>
            <h2 className="text-lg font-bold">حذف کسب‌وکار</h2>
            <p className="mt-1 text-sm leading-6 text-muted">نوبت‌ها، خدمات و مشتریان این صفحه پاک می‌شوند. برای تأیید، نام را دقیق بنویسید.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <TextInput value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="تأیید نام" />
              <Button
                type="button"
                variant="danger"
                disabled={confirmName.trim() !== form.name}
                onClick={async () => {
                  const res = await deleteBusinessFn({ data: { businessId } });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  localStorage.removeItem("nobatak.business");
                  toast.success("حذف شد");
                  window.location.assign("/panel");
                }}
              >
                حذف
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
