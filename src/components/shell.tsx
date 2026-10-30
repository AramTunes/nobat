import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Bell, Calendar, CalendarClock, Ellipsis, LayoutDashboard, Menu, User, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { meFn } from "@/lib/api";
import { AccountChip, useCurrentUserState } from "@/lib/session";
import { ThemeSwitch } from "@/lib/theme";

const links = [
  { to: "/explore", label: "کسب‌وکارها" },
  { to: "/me", label: "نوبت‌های من" },
  { to: "/panel", label: "پنل کسب‌وکار" },
] as const;

export function Shell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh">
      {header ?? (
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-jade text-on-jade">
              <CalendarClock className="size-5" aria-hidden="true" />
            </span>
            نوبتک
          </Link>
          <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="shrink-0 rounded-lg px-3 py-2 text-muted hover:bg-card hover:text-ink"
                activeProps={{ className: "shrink-0 rounded-lg bg-card px-3 py-2 font-semibold text-ink" }}
              >
                {link.label}
              </Link>
            ))}
            {!isPending && user ? (
              <Link
                to="/admin"
                className="shrink-0 rounded-lg px-3 py-2 text-muted hover:bg-card hover:text-ink"
                activeProps={{ className: "shrink-0 rounded-lg bg-card px-3 py-2 font-semibold text-ink" }}
              >
                مدیریت
              </Link>
            ) : null}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeSwitch className="w-40" />
            {isPending ? <span className="size-8 animate-pulse rounded-full bg-paper-deep" /> : null}
            {!isPending && user ? (
              <>
                <Link to="/me" aria-label="اعلان‌ها" className="grid size-11 place-items-center rounded-xl hover:bg-card">
                  <Bell className="size-5" />
                </Link>
                <AccountChip />
              </>
            ) : null}
            {!isPending && !user ? (
              <>
                <StartFreeLink className="px-3 text-sm" />
                <LoginLink />
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 md:hidden" dir="ltr">
            <button
              type="button"
              className="grid size-11 place-items-center rounded-xl border border-line bg-card text-ink"
              aria-label="منو"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            {!isPending && !user ? <LoginLink /> : null}
            {!isPending && user ? (
              <Link to="/me" aria-label="اعلان‌ها" className="grid size-11 place-items-center rounded-xl border border-line bg-card">
                <Bell className="size-5" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      )}
      {!header && menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن منو" onClick={() => setMenuOpen(false)} />
          <aside className="drawer-left absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col border-r border-line bg-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-extrabold">منو</span>
              <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-card" aria-label="بستن" onClick={() => setMenuOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-xl px-3 py-3 text-base text-muted hover:bg-card hover:text-ink"
                  activeProps={{ className: "rounded-xl bg-card px-3 py-3 text-base font-semibold text-ink" }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!isPending && user ? (
                <Link
                  to="/admin"
                  className="rounded-xl px-3 py-3 text-base text-muted hover:bg-card hover:text-ink"
                  activeProps={{ className: "rounded-xl bg-card px-3 py-3 text-base font-semibold text-ink" }}
                  onClick={() => setMenuOpen(false)}
                >
                  مدیریت
                </Link>
              ) : null}
            </nav>
            <div className="grid gap-3 border-t border-line p-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">حالت نمایش</p>
                <ThemeSwitch />
              </div>
              {!isPending && !user ? (
                <>
                  <LoginLink className="w-full justify-center" />
                  <StartFreeLink full className="px-4 text-sm" />
                </>
              ) : null}
              {!isPending && user ? <AccountChip /> : null}
            </div>
          </aside>
        </div>
      ) : null}
      <main className={`mx-auto w-full max-w-6xl px-4 py-6 ${user ? "pb-28 md:pb-6" : ""}`}>{children}</main>
      {user ? <MobileDock /> : null}
    </div>
  );
}

function LoginLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/auth"
      search={{ next: "/" }}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold text-ink ${className}`}
    >
      ورود
    </Link>
  );
}

export function StartFreeLink({ className = "", full = false }: { className?: string; full?: boolean }) {
  return (
    <Link to="/start" className={`relative inline-flex min-h-11 shrink-0 overflow-hidden rounded-xl p-px ${full ? "w-full" : ""}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[-100%]"
        style={{
          background:
            "conic-gradient(from var(--beam-angle), transparent 0 74%, var(--color-jade) 86%, var(--color-on-jade) 94%, transparent 100%)",
          animation: "beam 4s linear infinite",
        }}
      />
      <span
        className={`relative z-[1] inline-flex min-h-[calc(2.75rem-2px)] items-center justify-center rounded-[0.7rem] border border-line font-semibold ${full ? "w-full" : ""} ${className}`}
        style={{ background: "var(--start-bg)", color: "var(--start-fg)" }}
      >
        شروع رایگان
      </span>
    </Link>
  );
}

export function Subnav({
  items,
}: {
  items: { to: string; label: string; exact?: boolean }[];
}) {
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <Link
          key={item.to + item.label}
          to={item.to}
          activeOptions={{ exact: Boolean(item.exact) }}
          className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm"
          activeProps={{ className: "shrink-0 rounded-full bg-jade px-4 py-2 text-sm font-semibold text-on-jade" }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

const moreLinks = [
  { to: "/panel/customers" as const, label: "مشتریان" },
  { to: "/panel/services" as const, label: "خدمات" },
  { to: "/panel/staff" as const, label: "همکاران" },
  { to: "/panel/settings" as const, label: "تنظیمات" },
  { to: "/support" as const, label: "پشتیبانی" },
];

function dockTab(pathname: string) {
  if (pathname === "/panel" || pathname === "/panel/") return "dash";
  if (pathname.startsWith("/b/")) return "page";
  if (pathname.startsWith("/panel/calendar")) return "bookings";
  if (pathname.startsWith("/panel/reports")) return "reports";
  if (moreLinks.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))) return "more";
  return "";
}

function MobileDock() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useCurrentUserState();
  const [slug, setSlug] = useState("");
  const [more, setMore] = useState(false);
  const current = dockTab(pathname);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    meFn().then((res) => {
      if (!live || !res.ok) return;
      const saved = localStorage.getItem("nobatak.business") ?? "";
      const list = res.data.memberships ?? [];
      const match = list.find((item: { businessId: string; slug: string }) => item.businessId === saved) ?? list[0];
      setSlug(match?.slug ?? "");
    });
    return () => {
      live = false;
    };
  }, [user?.id]);

  const items = [
    { id: "dash", label: "داشبورد", icon: LayoutDashboard, to: "/panel" as const },
    { id: "page", label: "صفحه من", icon: User, to: "/b/$slug" as const },
    { id: "bookings", label: "نوبت‌ها", icon: Calendar, to: "/panel/calendar" as const },
    { id: "reports", label: "گزارشات", icon: BarChart3, to: "/panel/reports" as const },
  ];

  return (
    <>
      {more ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={() => setMore(false)} />
          <div className="absolute inset-x-3 bottom-24 grid gap-1 rounded-3xl border border-line bg-card p-2 shadow-xl">
            {moreLinks.map((item) => (
              <Link key={item.to} to={item.to} className="rounded-2xl px-4 py-3 text-sm font-semibold" onClick={() => setMore(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <nav
        className="fixed inset-x-3 z-40 grid grid-cols-5 rounded-full border border-line bg-card/95 px-1 py-1.5 shadow-lg backdrop-blur md:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {items.map((item) => {
          const active = current === item.id;
          const icon = <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />;
          const className = `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] ${active ? "font-bold text-ink" : "font-medium text-muted"}`;
          if (item.id === "page") {
            if (!slug) return <span key={item.id} className={className}>{icon}{item.label}</span>;
            return (
              <Link key={item.id} to="/b/$slug" params={{ slug }} className={className}>
                {icon}
                {item.label}
              </Link>
            );
          }
          return (
            <Link key={item.id} to={item.to} className={className}>
              {icon}
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] ${current === "more" ? "font-bold text-ink" : "font-medium text-muted"}`}
          onClick={() => setMore((value) => !value)}
        >
          <Ellipsis className="size-5" strokeWidth={current === "more" ? 2.25 : 1.75} />
          بیشتر
        </button>
      </nav>
    </>
  );
}