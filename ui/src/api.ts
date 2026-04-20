// ui/src/api.ts
// KISS HTTP client (fetch) + методы API в одном файле

export type TokenOut = {
  access_token: string;
  token_type: "bearer";
  user_id: number;
  username: string;
  roles: string[];
};

export type UserOut = {
  id: number;
  username: string;
  full_name?: string | null;
  is_active: boolean;
  roles: string[];
};

export type CarOut = {
  id: number;
  vin?: string | null;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  status: string;
  created_at: string;
};

export type ClientOut = {
  id: number;
  full_name: string;
  phone: string;
  doc_id?: string | null;
  note?: string | null;
  created_at: string;
};

export type DealOut = {
  id: number;
  client_id: number;
  car_id: number;
  manager_id: number;
  status_code: string;
  sale_price: number;
  discount: number;
  source: string;
  touches: number;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

export type PaymentOut = {
  id: number;
  deal_id: number;
  amount: number;
  kind: string;
  status: string;
  paid_at: string;
  note?: string | null;
};

export type ReportSummaryOut = {
  date_from: string;
  date_to: string;
  deals_total: number;
  deals_closed: number;
  revenue: number;
  avg_check: number;
};

export type AiTrainOut = {
  trained: boolean;
  samples: number;
  features: number;
  metrics: Record<string, any>;
  model_path: string;
};

export type AiPredictOut = {
  deal_id: number;
  probability_close: number;
  level: "low" | "medium" | "high";
  used_features: Record<string, any>;
};

export type AuditOut = {
  id: number;
  created_at: string;
  user_id?: number | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: string | null;
  ip?: string | null;
};

export type RoleOut = {
  id: number;
  name: string;
  title?: string | null;
  permissions: string[];
};

export type PermissionOut = {
  code: string;
  title?: string | null;
};

const API_BASE = String((import.meta as any).env.VITE_API_URL || "http://localhost:8000/api").replace(/\/+$/, "");

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: string, path: string, body?: any, qs?: Record<string, any>): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const target = `${API_BASE}${normalizedPath}`;
  const isAbsolute = API_BASE.startsWith("http://") || API_BASE.startsWith("https://");
  const url = isAbsolute ? new URL(target) : new URL(target, window.location.origin);
  if (qs) {
    Object.entries(qs).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = Array.isArray(data.detail) ? JSON.stringify(data.detail) : String(data.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  // 204 / empty
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const api = {
  // ---- health ----
  health: () => request<{ status: string }>("GET", "/health"),

  // ---- auth ----
  login: async (username: string, password: string) => {
    const data = await request<TokenOut>("POST", "/auth/login", { username, password });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("roles", JSON.stringify(data.roles || []));
    localStorage.setItem("username", data.username);
    return data;
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    localStorage.removeItem("username");
  },
  me: () => request<UserOut>("GET", "/auth/me"),

  // ---- dicts ----
  dealStatuses: () => request<Array<{ code: string; title: string; is_active: boolean }>>("GET", "/dicts/deal-statuses"),

  // ---- cars ----
  cars: (params?: { q?: string; status?: string }) => request<CarOut[]>("GET", "/cars", undefined, params),
  carGet: (id: number) => request<CarOut>("GET", `/cars/${id}`),
  carCreate: (payload: { vin?: string | null; brand: string; model: string; year: number; mileage: number; price: number }) =>
    request<CarOut>("POST", "/cars", payload),
  carUpdate: (id: number, payload: { vin?: string | null; brand: string; model: string; year: number; mileage: number; price: number }) =>
    request<CarOut>("PUT", `/cars/${id}`, payload),
  carDelete: (id: number) => request<{ deleted: boolean }>("DELETE", `/cars/${id}`),

  // ---- clients ----
  clients: (params?: { q?: string }) => request<ClientOut[]>("GET", "/clients", undefined, params),
  clientGet: (id: number) => request<ClientOut>("GET", `/clients/${id}`),
  clientCreate: (payload: { full_name: string; phone: string; doc_id?: string | null; note?: string | null }) =>
    request<ClientOut>("POST", "/clients", payload),
  clientUpdate: (id: number, payload: { full_name: string; phone: string; doc_id?: string | null; note?: string | null }) =>
    request<ClientOut>("PUT", `/clients/${id}`, payload),
  clientDelete: (id: number) => request<{ deleted: boolean }>("DELETE", `/clients/${id}`),

  // ---- deals ----
  deals: (params?: { status_code?: string; manager_id?: number; date_from?: string; date_to?: string }) =>
    request<DealOut[]>("GET", "/deals", undefined, params),
  dealGet: (id: number) => request<DealOut>("GET", `/deals/${id}`),
  dealCreate: (payload: { client_id: number; car_id: number; sale_price: number; discount: number; source?: string; touches?: number }) =>
    request<DealOut>("POST", "/deals", payload),
  dealChangeStatus: (id: number, status_code: string) => request<DealOut>("PUT", `/deals/${id}/status`, { status_code }),
  dealClose: (id: number) => request<DealOut>("POST", `/deals/${id}/close`),
  dealCancel: (id: number) => request<DealOut>("POST", `/deals/${id}/cancel`),

  // ---- payments ----
  payments: (params?: { deal_id?: number }) => request<PaymentOut[]>("GET", "/payments", undefined, params),
  paymentCreate: (payload: { deal_id: number; amount: number; kind?: string; status?: string; note?: string | null }) =>
    request<PaymentOut>("POST", "/payments", payload),

  // ---- reports ----
  reportSummary: (date_from: string, date_to: string) =>
    request<ReportSummaryOut>("GET", "/reports/summary", undefined, { date_from, date_to }),

  // ---- audit ----
  audit: (params?: { date_from?: string; date_to?: string; user_id?: number; entity?: string; action?: string }) =>
    request<AuditOut[]>("GET", "/audit", undefined, params),

  // ---- admin ----
  adminUsers: () => request<UserOut[]>("GET", "/admin/users"),
  adminUserCreate: (payload: { username: string; full_name?: string | null; password: string; role_names: string[] }) =>
    request<UserOut>("POST", "/admin/users", payload),
  adminUserUpdate: (id: number, payload: { full_name?: string | null; is_active?: boolean; password?: string | null; role_names?: string[] | null }) =>
    request<UserOut>("PUT", `/admin/users/${id}`, payload),

  adminRoles: () => request<RoleOut[]>("GET", "/admin/roles"),
  adminRoleCreate: (payload: { name: string; title?: string | null; permission_codes: string[] }) => request<RoleOut>("POST", "/admin/roles", payload),
  adminRoleUpdate: (id: number, payload: { title?: string | null; permission_codes?: string[] | null }) => request<RoleOut>("PUT", `/admin/roles/${id}`, payload),

  adminPermissions: () => request<PermissionOut[]>("GET", "/admin/permissions"),

  seed: () => request<any>("POST", "/admin/seed"),

  // ---- ai ----
  aiTrain: () => request<AiTrainOut>("POST", "/ai/train"),
  aiMetrics: () => request<any>("GET", "/ai/metrics"),
  aiPredict: (deal_id: number) => request<AiPredictOut>("GET", "/ai/predict", undefined, { deal_id }),
};

// helpers for auth in UI
export function getRoles(): string[] {
  try {
    return JSON.parse(localStorage.getItem("roles") || "[]");
  } catch {
    return [];
  }
}

export function hasRole(role: string): boolean {
  return getRoles().includes(role);
}

export function isAuthed(): boolean {
  return !!localStorage.getItem("token");
}
