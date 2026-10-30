import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/account";
import { Shell, Subnav } from "@/components/shell";
import { Button, Empty, Skeleton } from "@/components/ui";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { claimAdminFn } from "@/lib/api";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const account = useAccount();
  const [pending, setPending] = useState(false);
  if (account.isPending || (account.user && account.loading && !account.me)) {
    return <Shell><Skeleton className="h-40" /></Shell>;
  }
  if (!account.user) return <RedirectToSignIn />;
  if (!account.me?.isAdmin) {
    return (
      <Shell>
        <Empty
          title="مدیریت سامانه"
          body={account.me?.canClaim ? "هنوز مدیری تعیین نشده. اولین حساب واردشده می‌تواند مدیر سامانه شود. این کار فقط یک‌بار ممکن است." : "به این بخش دسترسی ندارید."}
          action={
            account.me?.canClaim ? (
              <Button
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  const res = await claimAdminFn();
                  setPending(false);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("مدیر سامانه شدید");
                    account.reload();
                  }
                }}
              >
                پذیرفتن مدیریت
              </Button>
            ) : undefined
          }
        />
      </Shell>
    );
  }
  return (
    <Shell>
      <h1 className="mb-3 text-2xl font-extrabold">مدیریت سامانه</h1>
      <Subnav
        items={[
          { to: "/admin", label: "نمای کلی", exact: true },
          { to: "/admin/users", label: "کاربران" },
          { to: "/admin/businesses", label: "کسب‌وکارها" },
          { to: "/admin/categories", label: "دسته‌ها" },
          { to: "/admin/audit", label: "حسابرسی" },
        ]}
      />
      <Outlet />
    </Shell>
  );
}
