import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PanelState, useAccount, useBusinessId } from "@/components/account";
import { DashboardHeader } from "@/components/dashboard-header";
import { Shell, Subnav } from "@/components/shell";
import { Badge, Skeleton } from "@/components/ui";
import { ROLE_FA } from "@/lib/booking/fa";
import { RedirectToSignIn } from "@/lib/auth/gates";

export const Route = createFileRoute("/panel")({ component: PanelLayout });

function PanelLayout() {
  const account = useAccount();
  const { businessId, choose } = useBusinessId(account.me?.memberships);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const home = pathname === "/panel" || pathname === "/panel/";
  if (account.isPending || (account.user && account.loading && !account.me)) {
    return <Shell><Skeleton className="h-40" /></Shell>;
  }
  if (!account.user) return <RedirectToSignIn />;
  const current = account.me?.memberships.find((item) => item.businessId === businessId);
  return (
    <Shell
      header={
        home ? (
          <DashboardHeader
            memberships={account.me?.memberships ?? []}
            businessId={businessId}
            onChoose={choose}
            onCreated={() => account.reload()}
          />
        ) : undefined
      }
    >
      {home ? null : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">پنل کسب‌وکار</h1>
            {current ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>{ROLE_FA[current.role] ?? current.role}</span>
                {current.status !== "active" ? <Badge tone="danger">{current.status === "suspended" ? "تعلیق‌شده" : "غیرفعال"}</Badge> : null}
              </p>
            ) : null}
          </div>
          {account.me && account.me.memberships.length > 0 ? (
            <select className="min-h-11 rounded-xl border border-line bg-card px-3" value={businessId} onChange={(e) => choose(e.target.value)} aria-label="کسب‌وکار">
              {account.me.memberships.map((item) => (
                <option key={item.businessId} value={item.businessId}>{item.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      )}
      {home ? null : (
        <Subnav
          items={[
            { to: "/panel", label: "خانه", exact: true },
            { to: "/panel/calendar", label: "تقویم" },
            { to: "/panel/services", label: "خدمات" },
            { to: "/panel/staff", label: "همکاران" },
            { to: "/panel/customers", label: "مشتریان" },
            { to: "/panel/settings", label: "تنظیمات" },
          ]}
        />
      )}
      <PanelState.Provider value={{
        businessId,
        memberships: account.me?.memberships ?? [],
        displayName: account.me?.profile.displayName ?? "",
        pageFor: account.me?.profile.pageFor ?? "",
        pageName: account.me?.profile.pageName ?? "",
      }}>
        <Outlet />
      </PanelState.Provider>
    </Shell>
  );
}