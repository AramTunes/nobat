import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readToken, writeToken } from "@/lib/api";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

type State = { user: AppUser | null; isPending: boolean };

const SessionContext = createContext<State>({ user: null, isPending: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ user: null, isPending: true });
  useEffect(() => {
    let live = true;
    const token = readToken();
    if (!token) {
      setState({ user: null, isPending: false });
      return;
    }
    fetch("/api/v1/session", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (!live) return;
        const user = json?.ok ? (json.data?.user ?? null) : null;
        setState({ user, isPending: false });
      })
      .catch(() => {
        if (live) setState({ user: null, isPending: false });
      });
    return () => {
      live = false;
    };
  }, []);
  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useCurrentUserState(): State {
  return useContext(SessionContext);
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}

export async function adoptSession(token: string) {
  writeToken(token);
}

export async function signOut() {
  const token = readToken();
  writeToken(null);
  try {
    await fetch("/api/v1/auth/signout", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  } catch {
    /* local sign-out still stands */
  }
  window.location.assign("/");
}

export function AccountChip() {
  const user = useCurrentUser();
  const [pending, setPending] = useState(false);
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "حساب";
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-full bg-jade-soft text-sm font-bold text-jade-deep">
        {label.charAt(0)}
      </span>
      <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{label}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void signOut();
        }}
        className="text-sm text-muted"
      >
        {pending ? "…" : "خروج"}
      </button>
    </div>
  );
}
