import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePanel } from "@/components/account";
import { Card, Skeleton } from "@/components/ui";
import { DualSpark } from "@/components/sparkline";
import { faNum, toman } from "@/lib/booking/fa";
import { dashboardFn } from "@/lib/api";

export const Route = createFileRoute("/panel/reports")({ component: ReportsPage });

function ReportsPage() {
  const { businessId } = usePanel();
  const [dash, setDash] = useState<{
    today: number;
    byStatus: Record<string, number>;
    capacity: { availableMinutes: number; occupiedMinutes: number; freeMinutes: number };
    stats?: { views: number; visitors: number; booked: number; cancelled: number; completed: number; sales: number; revenueToman: number };
    series?: { views: number[]; visitors: number[]; sales: number[]; revenue: number[] };
  } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    dashboardFn({ data: { businessId } }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDash(res.data);
    });
  }, [businessId]);

  if (!dash) return <Skeleton className="h-40" />;
  const total = Object.values(dash.byStatus).reduce((sum, n) => sum + n, 0);
  const stats = dash.stats ?? { views: 0, visitors: 0, booked: 0, cancelled: 0, completed: 0, sales: 0, revenueToman: 0 };
  const series = dash.series ?? { views: [], visitors: [], sales: [], revenue: [] };
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-extrabold">گزارشات</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold">بازدید و بازدیدکننده</div>
          <DualSpark primary={series.views} secondary={series.visitors} primaryColor="var(--color-jade)" secondaryColor="var(--color-copper)" />
        </Card>
        <Card>
          <div className="text-sm font-semibold">فروش و درآمد</div>
          <DualSpark primary={series.sales} secondary={series.revenue} primaryColor="var(--color-jade)" secondaryColor="var(--color-copper)" />
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["بازدید", faNum(stats.views)],
          ["بازدیدکننده", faNum(stats.visitors)],
          ["نوبت ثبت‌شده", faNum(stats.booked)],
          ["نوبت لغوشده", faNum(stats.cancelled)],
          ["نوبت تکمیل‌شده", faNum(stats.completed)],
          ["فروش", faNum(stats.sales)],
          ["درآمد", toman(stats.revenueToman)],
          ["امروز", faNum(dash.today)],
          ["هفت روز", faNum(total)],
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>
      <Card>
        <p className="text-sm leading-6 text-muted">
          ظرفیت هفت روز: {faNum(dash.capacity.freeMinutes)} دقیقه آزاد از {faNum(dash.capacity.availableMinutes)} دقیقه.
        </p>
      </Card>
    </div>
  );
}
