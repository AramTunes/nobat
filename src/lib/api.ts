export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const TOKEN_KEY = "nobat.token";

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function resolvePath(path: string) {
  if (typeof window !== "undefined") return path;
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const base = (env?.NOBAT_API_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
  return base + path;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(resolvePath(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد", code: "NETWORK" };
  }
  const json = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (json && typeof json === "object" && "ok" in json) return json;
  return { ok: false, error: "پاسخ سرور نامعتبر بود", code: "INTERNAL" };
}

const post = <T>(path: string, data?: unknown) => call<T>("POST", path, data ?? {});
const get = <T>(path: string) => call<T>("GET", path);

export const categoriesFn = () => get<any>("/api/v1/categories");
export const businessesFn = (args: { data?: Record<string, unknown> }) => {
  const data = args.data ?? {};
  const q = new URLSearchParams();
  if (data.q) q.set("q", String(data.q));
  if (data.category) q.set("category", String(data.category));
  if (data.limit != null) q.set("limit", String(data.limit));
  if (data.offset != null) q.set("offset", String(data.offset));
  return get<any>(`/api/v1/businesses?${q.toString()}`);
};
export const trackClickFn = (slug: string) => post<any>(`/api/v1/business/${encodeURIComponent(slug)}/click`);
export const publicBusinessFn = (args: { data: { slug?: string; track?: boolean } }) => {
  const slug = encodeURIComponent(args.data.slug ?? "");
  const visitor = args.data.track ? visitorId() : "";
  const q = visitor ? `?v=${encodeURIComponent(visitor)}` : "";
  return get<any>(`/api/v1/business/${slug}${q}`);
};

function visitorId() {
  if (typeof window === "undefined") return "";
  const key = "nobat.visitor";
  const saved = window.localStorage.getItem(key) ?? "";
  if (/^[a-zA-Z0-9_-]{8,64}$/.test(saved)) return saved;
  const next = crypto.randomUUID().replace(/-/g, "");
  window.localStorage.setItem(key, next);
  return next;
}
export const availabilityFn = (args: { data: Record<string, unknown> }) => {
  const q = new URLSearchParams();
  for (const key of ["businessId", "serviceId", "staffId", "day"]) {
    if (args.data[key] != null) q.set(key, String(args.data[key]));
  }
  return get<any>(`/api/v1/availability?${q.toString()}`);
};

export const lookupPhoneFn = (args: { data: unknown }) => post<any>("/api/v1/auth/lookup", args.data);
export const sendPhoneCodeFn = (args: { data: unknown }) => post<any>("/api/v1/auth/code", args.data);
export const signInPhoneFn = (args: { data: unknown }) => post<any>("/api/v1/auth/password", args.data);
export const signInPhoneCodeFn = (args: { data: unknown }) => post<any>("/api/v1/auth/code-login", args.data);
export const resetPhonePasswordFn = (args: { data: unknown }) => post<any>("/api/v1/auth/reset", args.data);
export const startAccountFn = (args: { data: unknown }) => post<any>("/api/v1/auth/start", args.data);

export const meFn = () => get<any>("/api/v1/me");
export const updateProfileFn = (args: { data: unknown }) => post<any>("/api/v1/me", args.data);
export const claimAdminFn = () => post<any>("/api/v1/admin/claim", {});
export const createBusinessFn = (args: { data: unknown }) => post<any>("/api/v1/businesses", args.data);
export const createDemoFn = () => post<any>("/api/v1/demo", {});
export const updateBusinessFn = (args: { data: unknown }) => post<any>("/api/v1/businesses/update", args.data);
export const deleteBusinessFn = (args: { data: unknown }) => post<any>("/api/v1/businesses/delete", args.data);
export const manageBusinessFn = (args: { data: unknown }) => post<any>("/api/v1/businesses/manage", args.data);
export const saveServiceFn = (args: { data: unknown }) => post<any>("/api/v1/services", args.data);
export const saveStaffFn = (args: { data: unknown }) => post<any>("/api/v1/staff", args.data);
export const saveScheduleFn = (args: { data: unknown }) => post<any>("/api/v1/schedule", args.data);
export const addHolidayFn = (args: { data: unknown }) => post<any>("/api/v1/holidays", args.data);
export const removeHolidayFn = (args: { data: unknown }) => post<any>("/api/v1/holidays/remove", args.data);
export const createBookingFn = (args: { data: unknown }) => post<any>("/api/v1/bookings", args.data);
export const setBookingStatusFn = (args: { data: unknown }) => post<any>("/api/v1/bookings/status", args.data);
export const rescheduleBookingFn = (args: { data: unknown }) => post<any>("/api/v1/bookings/reschedule", args.data);
export const myBookingsFn = () => get<any>("/api/v1/me/bookings");
export const businessBookingsFn = (args: { data: unknown }) => post<any>("/api/v1/business-bookings", args.data);
export const customersFn = (args: { data: unknown }) => post<any>("/api/v1/customers/list", args.data);
export const saveCustomerFn = (args: { data: unknown }) => post<any>("/api/v1/customers", args.data);
export const dashboardFn = (args: { data: unknown }) => post<any>("/api/v1/dashboard", args.data);
export const notificationsFn = () => get<any>("/api/v1/notifications");
export const markReadFn = (args: { data: unknown }) => post<any>("/api/v1/notifications/read", args.data);
export const adminOverviewFn = () => get<any>("/api/v1/admin/overview");
export const adminUsersFn = (args: { data: unknown }) => post<any>("/api/v1/admin/users", args.data);
export const adminBusinessesFn = (args: { data: unknown }) => post<any>("/api/v1/admin/businesses", args.data);
export const moderateBusinessFn = (args: { data: unknown }) => post<any>("/api/v1/admin/moderate", args.data);
export const adminCategoriesFn = () => get<any>("/api/v1/admin/categories");
export const saveCategoryFn = (args: { data: unknown }) => post<any>("/api/v1/admin/categories", args.data);
export const adminAuditFn = () => get<any>("/api/v1/admin/audit");
export const saveSettingsFn = (args: { data: unknown }) => post<any>("/api/v1/admin/settings", args.data);
