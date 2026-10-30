import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { Button, Card, Empty, Field, Area, Skeleton, TextInput } from "@/components/ui";
import { faNum } from "@/lib/booking/fa";
import { formatWhen } from "@/lib/booking/format";
import { customersFn, saveCustomerFn } from "@/lib/api";

export const Route = createFileRoute("/panel/customers")({ component: CustomersPage });

type Customer = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  visits: number;
  lastVisit: string | null;
};

function CustomersPage() {
  const { businessId } = usePanel();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", phone: "", notes: "" });

  function load(id: string, query: string) {
    setLoading(true);
    customersFn({ data: { businessId: id, q: query } }).then((res) => {
      setRows(res.ok ? res.data : []);
      setLoading(false);
      if (!res.ok) toast.error(res.error);
    });
  }
  useEffect(() => {
    if (businessId) load(businessId, "");
  }, [businessId]);

  if (!businessId) return <Empty title="اول کسب‌وکار بسازید" body="مشتریان بعد از ساخت صفحه یا اولین رزرو این‌جا می‌آیند." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <h2 className="text-lg font-bold">{form.id ? "ویرایش مشتری" : "مشتری حضوری"}</h2>
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const res = await saveCustomerFn({
              data: { businessId, name: form.name, phone: form.phone, notes: form.notes, ...(form.id ? { id: form.id } : {}) },
            });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("ذخیره شد");
            setForm({ id: "", name: "", phone: "", notes: "" });
            load(businessId, q);
          }}
        >
          <Field label="نام"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></Field>
          <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="یادداشت"><Area value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex gap-2">
            <Button type="submit">ذخیره</Button>
            {form.id ? <Button type="button" variant="quiet" onClick={() => setForm({ id: "", name: "", phone: "", notes: "" })}>انصراف</Button> : null}
          </div>
        </form>
      </Card>
      <div className="grid content-start gap-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            load(businessId, q);
          }}
        >
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی نام یا تلفن" aria-label="جست‌وجو" />
          <Button type="submit" variant="quiet">جست‌وجو</Button>
        </form>
        {loading ? <Skeleton className="h-24" /> : null}
        {!loading && rows.length === 0 ? <Empty title="مشتری‌ای نیست" body="با رزرو آنلاین یا ثبت دستی، نام این‌جا دیده می‌شود." /> : null}
        {rows.map((row) => (
          <button key={row.id} type="button" className="rounded-card border border-line bg-card p-4 text-start hover:border-jade" onClick={() => setForm({ id: row.id, name: row.name, phone: row.phone, notes: row.notes })}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{row.name}</h3>
              <span className="text-sm text-muted">{faNum(row.visits)} مراجعه</span>
            </div>
            <p className="mt-1 text-sm text-muted" dir="ltr">{row.phone ? faNum(row.phone) : "بدون تلفن"}</p>
            {row.lastVisit ? <p className="mt-1 text-sm">آخرین نوبت: {formatWhen(row.lastVisit, "Asia/Tehran")}</p> : null}
            {row.notes ? <p className="mt-2 text-sm leading-6">{row.notes}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
