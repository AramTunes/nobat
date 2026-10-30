import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Skeleton } from "@/components/ui";
import { faNum } from "@/lib/booking/fa";
import { formatWhen } from "@/lib/booking/format";
import { adminAuditFn } from "@/lib/api";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

type Log = {
  id: string;
  actorUserId: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string;
  createdAt: string;
};

const ACTION: Record<string, string> = {
  create_business: "ساخت کسب‌وکار",
  update_business: "ویرایش کسب‌وکار",
  delete_business: "حذف کسب‌وکار",
  booking_status: "تغییر وضعیت نوبت",
  reschedule: "جابه‌جایی نوبت",
  moderate_business: "نظارت کسب‌وکار",
  save_category: "ویرایش دسته",
  save_settings: "تنظیمات سامانه",
  claim_admin: "تعیین مدیر",
};

function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [jobs, setJobs] = useState<{ channel: string; status: string; n: number }[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAuditFn().then((res) => {
      if (!res.ok) toast.error(res.error);
      else {
        setLogs(res.data.logs);
        setJobs(res.data.jobs);
        setNote(res.data.errorLog);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="font-bold">کارهای اعلان</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{note} وضعیت skipped یعنی ارسال نشده است.</p>
        <ul className="mt-3 grid gap-1 text-sm">
          {jobs.length === 0 ? <li className="text-muted">کاری ثبت نشده.</li> : null}
          {jobs.map((job) => (
            <li key={job.channel + job.status} className="flex justify-between">
              <span dir="ltr">{job.channel} · {job.status}</span>
              <span className="tabular-nums">{faNum(job.n)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-2">
        {logs.length === 0 ? <Card><p className="text-sm text-muted">رخدادی نیست.</p></Card> : null}
        {logs.map((log) => (
          <Card key={log.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{ACTION[log.action] ?? log.action}</div>
                <p className="text-sm text-muted">{log.entity}{log.detail ? ` · ${log.detail}` : ""}</p>
              </div>
              <time className="text-sm text-muted">{formatWhen(log.createdAt, "Asia/Tehran")}</time>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
