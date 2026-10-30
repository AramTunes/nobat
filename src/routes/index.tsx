import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Clock3, Store } from "lucide-react";
import { Shell, StartFreeLink } from "@/components/shell";
import { Badge, Card } from "@/components/ui";
import { businessesFn, categoriesFn } from "@/lib/api";

type Category = { id: string; name: string; slug: string };
type Biz = { name: string; slug: string; city: string; category_name: string | null; description: string; is_demo: boolean };

export const Route = createFileRoute("/")({
  loader: async () => {
    const [categories, businesses] = await Promise.all([
      categoriesFn(),
      businessesFn({ data: { limit: 6 } }),
    ]);
    return {
      categories: (categories.ok ? categories.data : []) as Category[],
      businesses: (businesses.ok ? (businesses.data.items ?? []) : []) as Biz[],
    };
  },
  component: Home,
});

function Home() {
  const { categories, businesses } = Route.useLoaderData();
  return (
    <Shell>
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-5">
          <Badge tone="copper">نوبت‌دهی برای کسب‌وکارهای مستقل</Badge>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">وقت مشتری، بدون تماس و تداخل</h1>
          <p className="max-w-xl text-base leading-7 text-muted">
            نوبتک صفحه کسب‌وکار، خدمات، ساعت کاری و زمان‌های واقعاً آزاد را نشان می‌دهد. رزرو روی سرور دوباره بررسی می‌شود تا دو نفر یک صندلی را نگیرند.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/explore" search={{ q: "", category: "" }} className="inline-flex min-h-11 items-center rounded-xl bg-jade px-5 font-semibold text-on-jade">
              پیدا کردن نوبت
            </Link>
            <StartFreeLink className="px-5" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "قفل ظرفیت", "هم‌زمانی رزرو در پایگاه داده بسته می‌شود."],
              [Clock3, "تقویم شمسی", "نمایش فارسی، ذخیره زمان با منطقه زمانی کسب‌وکار."],
              [Store, "پنل مستقل", "خدمت، همکار، مشتری و وضعیت نوبت."],
            ].map(([Icon, title, body]) => (
              <li key={String(title)} className="rounded-card border border-line bg-card p-4">
                <Icon className="mb-2 size-5 text-jade" aria-hidden="true" />
                <div className="font-semibold">{String(title)}</div>
                <p className="mt-1 text-sm text-muted">{String(body)}</p>
              </li>
            ))}
          </ul>
        </div>
        <Card>
          <p className="text-xs font-semibold text-copper">کارت نمونه طراحی، نه یک نوبت واقعی</p>
          <h2 className="mt-3 text-2xl font-extrabold">اصلاح مو</h2>
          <p className="mt-1 text-sm text-muted">آرایشگاه سرو · سارا کریمی</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-paper p-3">
              <div className="text-xs text-muted">ساعت</div>
              <div className="text-2xl font-bold tabular-nums">۱۱:۳۰</div>
            </div>
            <div className="rounded-xl bg-jade-soft p-3 text-jade-deep">
              <div className="text-xs">مدت</div>
              <div className="text-2xl font-bold">۴۵ دقیقه</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">بعد از ثبت‌نام، یا کسب‌وکار خودتان را می‌سازید یا یک نمونه قابل حذف برای تمرین رزرو.</p>
        </Card>
      </section>
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-bold">دسته‌ها</h2>
          <Link to="/explore" search={{ q: "", category: "" }} className="inline-flex items-center gap-1 text-sm font-semibold text-jade">
            همه <ArrowLeft className="size-4" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Link key={cat.id} to="/explore" search={{ category: cat.slug, q: "" }} className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm">
              {cat.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-bold">کسب‌وکارهای فعال</h2>
        {businesses.length === 0 ? (
          <p className="text-sm text-muted">هنوز صفحه‌ای منتشر نشده. اولین کسب‌وکار را از پنل بسازید.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((biz) => (
              <Link key={biz.slug} to="/b/$slug" params={{ slug: biz.slug }} className="rounded-card border border-line bg-card p-4 hover:border-jade">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{biz.name}</h3>
                  {biz.is_demo ? <Badge>نمونه</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">{biz.category_name}{biz.city ? ` · ${biz.city}` : ""}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6">{biz.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mt-12 grid gap-4 rounded-card bg-ink p-6 text-on-ink sm:grid-cols-3">
        {[
          ["۱", "خدمت و همکار را تعریف کنید"],
          ["۲", "مشتری زمان آزاد را می‌بیند"],
          ["۳", "نوبت در تقویم شما می‌نشیند و قابل لغو است"],
        ].map(([n, text]) => (
          <div key={n}>
            <div className="text-sm text-copper">{n}</div>
            <p className="mt-1 font-semibold">{text}</p>
          </div>
        ))}
      </section>
      <p className="mt-8 text-xs text-muted">پرداخت آنلاین در این نسخه فعال نیست و وضعیت اشتراک «فعال» ساخته نمی‌شود.</p>
    </Shell>
  );
}
