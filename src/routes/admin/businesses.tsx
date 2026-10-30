import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Area, Select, Skeleton, TextInput } from "@/components/ui";
import { adminBusinessesFn, moderateBusinessFn } from "@/lib/api";

export const Route = createFileRoute("/admin/businesses")({ component: BusinessesPage });

type Biz = {
  id: string;
  name: string;
  slug: string;
  status: string;
  status_reason: string;
  city: string;
  is_demo: boolean;
};

const LABEL: Record<string, string> = { active: "فعال", inactive: "غیرفعال", suspended: "تعلیق" };

function BusinessesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, { status: string; reason: string }>>({});

  function load(query: string) {
    setLoading(true);
    adminBusinessesFn({ data: { q: query } }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      setRows(res.data);
      setDraft(Object.fromEntries(res.data.map((row: { id: string; status: string; status_reason: string }) => [row.id, { status: row.status, reason: row.status_reason }])));
      setLoading(false);
    });
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(q); }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا شهر" aria-label="جست‌وجو" />
        <Button type="submit" variant="quiet">جست‌وجو</Button>
      </form>
      {loading ? <Skeleton className="h-24" /> : null}
      {!loading && rows.length === 0 ? <Card><p className="text-sm text-muted">کسب‌وکاری نیست.</p></Card> : null}
      {rows.map((row) => {
        const item = draft[row.id] ?? { status: row.status, reason: row.status_reason };
        return (
          <Card key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">{row.name}</h2>
                <p className="text-sm text-muted">{row.city || "بدون شهر"} · {row.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                {row.is_demo ? <Badge tone="copper">نمونه</Badge> : null}
                <Badge tone={row.status === "active" ? "jade" : "danger"}>{LABEL[row.status] ?? row.status}</Badge>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
              <Field label="وضعیت">
                <Select value={item.status} onChange={(e) => setDraft({ ...draft, [row.id]: { ...item, status: e.target.value } })}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                  <option value="suspended">تعلیق</option>
                </Select>
              </Field>
              <Field label="دلیل، اگر فعال نیست">
                <Area value={item.reason} onChange={(e) => setDraft({ ...draft, [row.id]: { ...item, reason: e.target.value } })} />
              </Field>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    const res = await moderateBusinessFn({ data: { businessId: row.id, status: item.status, reason: item.reason } });
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success("وضعیت عوض شد");
                      load(q);
                    }
                  }}
                >
                  اعمال
                </Button>
                <Link to="/b/$slug" params={{ slug: row.slug }} className="inline-flex min-h-11 items-center text-sm font-semibold text-jade">صفحه</Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
