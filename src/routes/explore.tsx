import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Empty, Skeleton, TextInput } from "@/components/ui";
import { businessesFn, categoriesFn } from "@/lib/api";

export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    category: typeof search.category === "string" ? search.category : "",
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [items, setItems] = useState<
    { id: string; name: string; slug: string; city: string; description: string; category_name: string | null; is_demo: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoriesFn().then((res) => {
      if (res.ok) setCategories(res.data);
    });
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    businessesFn({ data: { q: search.q, category: search.category, limit: 24 } }).then((res) => {
      if (!live) return;
      setItems(res.ok ? res.data.items : []);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [search.q, search.category]);

  return (
    <Shell>
      <h1 className="text-3xl font-extrabold">کسب‌وکارها</h1>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search: { q, category: search.category } });
        }}
      >
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا شهر" aria-label="جستجو" />
        <button className="min-h-11 rounded-xl bg-jade px-4 text-sm font-semibold text-on-jade" type="submit">جستجو</button>
      </form>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        <button type="button" onClick={() => navigate({ search: { q: search.q, category: "" } })} className={`shrink-0 rounded-full px-4 py-2 text-sm ${search.category === "" ? "bg-jade text-on-jade" : "border border-line bg-card"}`}>همه</button>
        {categories.map((cat) => (
          <button key={cat.id} type="button" onClick={() => navigate({ search: { q: search.q, category: cat.slug } })} className={`shrink-0 rounded-full px-4 py-2 text-sm ${search.category === cat.slug ? "bg-jade text-on-jade" : "border border-line bg-card"}`}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : items.length === 0 ? (
          <div className="sm:col-span-2">
            <Empty title="کسب‌وکاری با این مشخصات نیست" body="دسته دیگری را انتخاب کنید یا خودتان صفحه کسب‌وکار بسازید." />
          </div>
        ) : (
          items.map((biz) => (
            <Link key={biz.id} to="/b/$slug" params={{ slug: biz.slug }} className="rounded-card border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{biz.name}</h2>
                {biz.is_demo ? <Badge tone="copper">نمونه</Badge> : <Badge>{biz.category_name || "کسب‌وکار"}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted">{biz.city || "شهر ثبت نشده"}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6">{biz.description}</p>
            </Link>
          ))
        )}
      </div>
    </Shell>
  );
}
