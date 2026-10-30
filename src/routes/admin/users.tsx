import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Skeleton, TextInput } from "@/components/ui";
import { formatWhen } from "@/lib/booking/format";
import { adminUsersFn } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type User = { id: string; name: string; email: string; createdAt: string; isAdmin: boolean };

function UsersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  function load(query: string) {
    setLoading(true);
    adminUsersFn({ data: { q: query } }).then((res) => {
      setRows(res.ok ? res.data : []);
      setLoading(false);
      if (!res.ok) toast.error(res.error);
    });
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(q); }}>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا ایمیل" aria-label="جست‌وجوی کاربر" />
        <Button type="submit" variant="quiet">جست‌وجو</Button>
      </form>
      {loading ? <Skeleton className="h-24" /> : null}
      {!loading && rows.length === 0 ? <Card><p className="text-sm text-muted">کاربری پیدا نشد.</p></Card> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold">{row.name || "بدون نام"}</div>
              <p className="text-sm text-muted" dir="ltr">{row.email}</p>
            </div>
            {row.isAdmin ? <Badge>مدیر سامانه</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-muted">عضویت {formatWhen(row.createdAt, "Asia/Tehran")}</p>
        </Card>
      ))}
    </div>
  );
}
