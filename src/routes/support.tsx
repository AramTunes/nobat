import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">پشتیبانی</h1>
      <p className="mt-2 text-sm leading-6 text-muted">این صفحه را بعداً کامل می‌کنیم.</p>
    </Shell>
  );
}
