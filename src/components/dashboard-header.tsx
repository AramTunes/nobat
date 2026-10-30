import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, ChevronDown, Headset, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Membership } from "@/components/account";
import { Button, Field, TextInput } from "@/components/ui";
import { categoriesFn, createBusinessFn } from "@/lib/api";

export function DashboardHeader({
  memberships,
  businessId,
  onChoose,
  onCreated,
}: {
  memberships: Membership[];
  businessId: string;
  onChoose: (id: string) => void;
  onCreated: () => void;
}) {
  const current = memberships.find((item) => item.businessId === businessId) ?? memberships[0];
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight" aria-label="نوبتک">
          <span className="grid size-9 place-items-center rounded-xl bg-jade text-on-jade">
            <CalendarClock className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">نوبتک</span>
        </Link>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            className="flex max-w-[70vw] items-center gap-2 rounded-xl border border-line bg-card px-2.5 py-1.5 shadow-sm"
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((value) => !value)}
          >
            <Mark name={current?.name ?? "کسب‌وکار"} />
            <span className="truncate text-sm font-bold">{current?.name ?? "بدون کسب‌وکار"}</span>
            <ChevronDown className={`size-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open ? (
            <div className="absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-card shadow-xl">
              <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
                {memberships.map((item) => (
                  <li key={item.businessId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-paper"
                      onClick={() => {
                        onChoose(item.businessId);
                        setOpen(false);
                      }}
                    >
                      <Mark name={item.name} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                      {item.businessId === businessId ? <Check className="size-4 shrink-0 text-jade" aria-hidden="true" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-paper"
                  onClick={() => {
                    setOpen(false);
                    setCreating(true);
                  }}
                >
                  <span className="grid size-8 place-items-center rounded-lg border border-dashed border-line">
                    <Plus className="size-4" aria-hidden="true" />
                  </span>
                  کسب‌وکار جدید
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <Link
          to="/support"
          aria-label="پشتیبانی"
          className="absolute left-4 grid size-11 place-items-center rounded-xl border border-line bg-card text-ink"
        >
          <Headset className="size-5" />
        </Link>
      </div>
      {open ? <button type="button" className="fixed inset-0 z-20" aria-label="بستن فهرست" onClick={() => setOpen(false)} /> : null}
      {creating ? (
        <CreateBusiness
          onClose={() => setCreating(false)}
          onDone={(id) => {
            onChoose(id);
            onCreated();
            setCreating(false);
          }}
        />
      ) : null}
    </header>
  );
}

function Mark({ name }: { name: string }) {
  const letter = name.trim().slice(0, 1) || "ن";
  return <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-jade text-sm font-bold text-on-jade">{letter}</span>;
}

function CreateBusiness({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: "", city: "", phone: "", categoryId: "cat-beauty" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    categoriesFn().then((res) => {
      if (res.ok && res.data[0]) {
        setCategories(res.data);
        setForm((current) => ({ ...current, categoryId: current.categoryId || res.data[0].id }));
      }
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={onClose} />
      <form
        className="relative z-10 grid w-full max-w-md gap-3 rounded-card border border-line bg-card p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          void createBusinessFn({ data: { ...form, timezone: "Asia/Tehran" } }).then((res) => {
            setPending(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("کسب‌وکار ساخته شد");
            onDone(res.data.businessId);
          });
        }}
      >
        <h2 className="text-lg font-extrabold">کسب‌وکار جدید</h2>
        <Field label="نام"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="شهر"><TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="تلفن"><TextInput dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="دسته">
          <select className="min-h-11 rounded-xl border border-line bg-card px-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="quiet" onClick={onClose}>انصراف</Button>
          <Button type="submit" variant="signup" disabled={pending}>{pending ? "در حال ساخت" : "ساخت"}</Button>
        </div>
      </form>
    </div>
  );
}
