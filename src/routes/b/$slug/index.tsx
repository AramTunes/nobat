import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import { Shell } from "@/components/shell";
import { Badge, Card, Empty, Skeleton } from "@/components/ui";
import { WEEKDAYS_FA, clockLabel, faNum, minutesLabel, toman } from "@/lib/booking/fa";
import { publicBusinessFn, trackClickFn } from "@/lib/api";

export const Route = createFileRoute("/b/$slug/")({ component: BusinessPage });

type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceToman: number;
};
type Person = {
  id: string;
  name: string;
  title: string;
  weekly: { weekday: number; startMin: number; endMin: number }[];
};
type Biz = {
  name: string;
  description: string;
  isDemo: boolean;
  categoryName: string;
  city: string;
  address: string;
  phone: string;
  timezone: string;
  cancelBeforeMinutes: number;
  minLeadMinutes: number;
  maxHorizonDays: number;
  services: Service[];
  staff: Person[];
};

function BusinessPage() {
  const { slug } = Route.useParams();
  const [biz, setBiz] = useState<Biz | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    publicBusinessFn({ data: { slug, track: true } }).then((res) => {
      if (!live) return;
      if (res.ok) setBiz(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [slug]);
  return (
    <Shell>
      {loading ? <Skeleton className="h-48" /> : null}
      {error ? <Empty title="صفحه در دسترس نیست" body={error} /> : null}
      {biz ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold">{biz.name}</h1>
                {biz.isDemo ? <Badge tone="copper">داده نمونه</Badge> : null}
                {biz.categoryName ? <Badge>{biz.categoryName}</Badge> : null}
              </div>
              <p className="mt-3 max-w-2xl leading-7 text-muted">{biz.description}</p>
              <p className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{biz.city} {biz.address}</span>
                {biz.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-4" />{faNum(biz.phone)}</span> : null}
              </p>
            </div>
            <Link
              to="/b/$slug/book"
              params={{ slug }}
              className="inline-flex min-h-11 items-center rounded-xl bg-jade px-5 font-semibold text-on-jade"
              onClick={() => { void trackClickFn(slug); }}
            >
              رزرو نوبت
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="grid gap-3">
              {biz.services.map((service) => (
                <Card key={service.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{service.name}</h2>
                      <p className="mt-1 text-sm text-muted">{service.description}</p>
                    </div>
                    <div className="text-end">
                      <div className="font-bold tabular-nums">{toman(service.priceToman)}</div>
                      <div className="text-sm text-muted">{minutesLabel(service.durationMinutes)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Card>
              <h2 className="font-bold">همکاران و ساعت کاری</h2>
              <p className="mt-1 text-xs text-muted">منطقه زمانی: {biz.timezone}</p>
              <ul className="mt-4 grid gap-4">
                {biz.staff.map((person) => (
                  <li key={person.id}>
                    <div className="font-semibold">{person.name}</div>
                    <div className="text-sm text-muted">{person.title}</div>
                    <ul className="mt-2 grid gap-1 text-sm">
                      {person.weekly.map((row) => (
                        <li key={row.weekday} className="flex justify-between gap-3">
                          <span>{WEEKDAYS_FA[row.weekday]}</span>
                          <span className="tabular-nums">{clockLabel(row.startMin)} تا {clockLabel(row.endMin)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-muted">
                لغو توسط مشتری تا {biz.cancelBeforeMinutes} دقیقه قبل از نوبت. رزرو از {biz.minLeadMinutes} دقیقه بعد تا {biz.maxHorizonDays} روز آینده.
              </p>
            </Card>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
