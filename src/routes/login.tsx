import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    const next = typeof search.next === "string" && search.next.startsWith("/") && !search.next.startsWith("//") ? search.next : "/panel";
    return { next };
  },
  component: LoginRedirect,
});

function LoginRedirect() {
  const { next } = Route.useSearch();
  return <Navigate to="/auth" search={{ next }} />;
}
