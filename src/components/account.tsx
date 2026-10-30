import { createContext, useContext, useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/session";
import { meFn } from "@/lib/api";
import { Shell } from "./shell";
import { Skeleton } from "./ui";

export type Membership = {
  businessId: string;
  role: string;
  name: string;
  slug: string;
  status: string;
};

export type Me = {
  profile: {
    displayName: string;
    phone: string;
    email: string;
    username: string;
    pageFor: string;
    pageName: string;
    activityName: string;
  };
  isAdmin: boolean;
  canClaim: boolean;
  unread: number;
  memberships: Membership[];
};

export function useAccount() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let live = true;
    meFn().then((res) => {
      if (!live) return;
      if (res.ok) setMe(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [user?.id, isPending, nonce]);
  return {
    user,
    isPending,
    me,
    error,
    loading,
    reload: () => {
      setLoading(true);
      setNonce((n) => n + 1);
    },
  };
}

export function useBusinessId(memberships: Membership[] | undefined) {
  const [businessId, setBusinessId] = useState("");
  useEffect(() => {
    if (!memberships?.length) {
      setBusinessId("");
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem("nobatak.business") ?? "" : "";
    const next = memberships.some((item) => item.businessId === saved) ? saved : memberships[0].businessId;
    setBusinessId(next);
  }, [memberships]);
  function choose(next: string) {
    localStorage.setItem("nobatak.business", next);
    setBusinessId(next);
  }
  return { businessId, choose };
}

export const PanelState = createContext<{
  businessId: string;
  memberships: Membership[];
  displayName: string;
  pageFor: string;
  pageName: string;
}>({
  businessId: "",
  memberships: [],
  displayName: "",
  pageFor: "",
  pageName: "",
});

export function usePanel() {
  return useContext(PanelState);
}

export function AuthWall({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  if (account.isPending || (account.user && account.loading && !account.me)) {
    return (
      <Shell>
        <Skeleton className="h-40" />
      </Shell>
    );
  }
  if (!account.user) return <RedirectToSignIn />;
  return children;
}
