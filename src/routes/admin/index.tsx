import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Skeleton, TextInput } from "@/components/ui";
import { faNum } from "@/lib/booking/fa";
import { adminOverviewFn, saveSettingsFn } from "@/lib/api";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

type Overview = {
  users: number;
  businesses: Record<string, number>;
  bookings: Record<string, number>;
  settings: { key: string; value: string }[];
  note: string;
};

const STATUS: Record<string, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  suspended: "تعلیق",
  pending: "در انتظار",
  confirmed: "تأییدشده",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  no_show: "عدم مراجعه",
};

function AdminHome() {
  const [data, setData] = useState<Overview | null>(null);
  const [name, setName] = useState("نوبتک");
  const [email, setEmail] = useState("");

  function load() {
    adminOverviewFn().then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setData(res.data);
      const map = Object.fromEntries(res.data.settings.map((item: { key: string; value: string }) => [item.key, item.value]));
      setName(map.platform_name || "نوبتک");
      setEmail(map.support_email || "");
    });
  }
  useEffect(() => {
    load();
  }, []);
  if (!data) return <Skeleton className="h-40" />;
  const bizTotal = Object.values(data.businesses).reduce((sum, n) => sum + n, 0);
  const bookTotal = Object.values(data.bookings).reduce((sum, n) => sum + n, 0);
  return (
    <div className="grid gap-4">
      <Card>
        <p className="text-sm leading-6 text-muted">ارسال پیامک و ایمیل وصل نیست. اعلان‌ها فقط داخل برنامه ثبت می‌شوند و به‌عنوان پیام واقعی نشان داده نمی‌شوند.</p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["کاربران", data.users],
          ["کسب‌وکارها", bizTotal],
          ["نوبت‌ها", bookTotal],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums">{faNum(Number(value))}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-bold">وضعیت کسب‌وکارها</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {Object.entries(data.businesses).map(([key, n]) => (
              <li key={key} className="flex justify-between"><span>{STATUS[key] ?? key}</span><span className="tabular-nums">{faNum(n)}</span></li>
            ))}
            {Object.keys(data.businesses).length === 0 ? <li className="text-muted">هنوز کسب‌وکاری نیست.</li> : null}
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold">وضعیت نوبت‌ها</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {Object.entries(data.bookings).map(([key, n]) => (
              <li key={key} className="flex justify-between"><span>{STATUS[key] ?? key}</span><span className="tabular-nums">{faNum(n)}</span></li>
            ))}
            {Object.keys(data.bookings).length === 0 ? <li className="text-muted">نوبتی ثبت نشده.</li> : null}
          </ul>
        </Card>
      </div>
      <Card>
        <h2 className="font-bold">تنظیمات عمومی</h2>
        <p className="mt-1 text-sm text-muted">{data.note}</p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const res = await saveSettingsFn({ data: { platform_name: name, support_email: email } });
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("ذخیره شد");
              setData(res.data);
            }
          }}
        >
          <Field label="نام پلتفرم"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="ایمیل پشتیبانی"><TextInput dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" className="sm:col-span-2 sm:w-fit">ذخیره</Button>
        </form>
      </Card>
    </div>
  );
}
